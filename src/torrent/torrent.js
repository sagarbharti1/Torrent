import fs from 'fs'
import path from 'path'
import EventEmitter from 'events'

import Peer from '../peers/peer.js'
import Tracker from '../tracker/tracker.js'
import PieceManager from './pieces.js'
import TorrentMetadata from './torrentParser.js'

export default class Torrent extends EventEmitter {
  clientConfig
  downloadPath
  metadata
  files = []
  peers = []
  trackers = []
  pieceManager

  constructor(torrentId, clientConfig, downloadPath) {
    super()
    this.clientConfig = clientConfig
    this.downloadPath = downloadPath
    this.metadata = new TorrentMetadata(torrentId)
    this.pieceManager = new PieceManager(this.metadata)
    const filesInfo = this.metadata.filesData
    if (filesInfo) {
      // Multi-file mode
      filesInfo.forEach((file) => {
        const filePath = path.join(this.downloadPath, ...file.path)
        const dirPath = path.dirname(filePath)
        fs.mkdirSync(dirPath, { recursive: true })
        this.files.push({ path: filePath, length: file.length })
        fs.openSync(filePath, 'w')
      })
    }
    console.log(`files = ${this.files}`)
    this.updateTrackers()
  }

  updateTrackers() {
    this.trackers = this.metadata.announce.map(
      (url) => new Tracker(url, this.clientConfig, this.metadata)
    )
  }

  async updatePeers() {
    const peersData = await Promise.all(
      this.trackers.map((tracker) => tracker.fetchPeers())
    )
    this.peers = peersData
      .flat()
      .map(
        ({ ip, port }) =>
          new Peer(
            ip,
            port,
            this.clientConfig,
            this.metadata,
            this.pieceManager
          )
      )
  }

  async download() {
    await this.updatePeers()
    this.peers.forEach((peer) => {
      peer.connect()
      peer.on('piece', this.handlePieceResponse.bind(this))
    })
  }

  handlePieceResponse(response) {
    this.pieceManager.printPercentDone()
    this.pieceManager.addReceived(response)

    let pieceOffset =
      response.index * this.metadata.infoPieceLength + response.begin
    let remainingLength = response.block.length

    for (const file of this.files) {
      console.log(file.path)
      if (pieceOffset < file.length) {
        const fileOffset = pieceOffset
        const writeLength = Math.min(remainingLength, file.length - fileOffset)

        fs.writeSync(
          fs.openSync(file.path, 'r+'),
          response.block,
          response.block.length - remainingLength,
          writeLength,
          fileOffset
        )

        remainingLength -= writeLength
        pieceOffset += writeLength

        if (remainingLength <= 0) break
      } else {
        pieceOffset -= file.length
      }
    }

    if (this.pieceManager.isDone()) {
      console.log('DONE!')
      try {
        this.files.forEach((file) => fs.closeSync(fs.openSync(file.path, 'r+')))
      } catch (err) {
        console.error('Failed to close the file')
      }
    }
  }
}
