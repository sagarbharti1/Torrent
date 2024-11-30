import crypto from 'crypto'
import fs from 'fs'
import bencode from 'bencode'
import * as utility from '../../utils.js'
export const BLOCK_LENGTH = 2 ** 14

export default class TorrentMetadata {
  announce = []
  infoHash
  infoHashBuffer
  infoName
  infoLength
  infoPieceLength
  infoPieces
  filesData = []

  constructor(torrentId) {
    if (torrentId.endsWith('.torrent')) {
      this.decodeTorrentFile(torrentId)
    } else {
      throw new Error('Unsupported torrent file extension')
    }
  }

  decodeTorrentFile(filename) {
    const torrentObject = bencode.decode(fs.readFileSync(filename))
    this.extractAnnounce(torrentObject)
    this.extractInfoHash(torrentObject)
    this.extractInfoName(torrentObject)
    this.extractInfoLength(torrentObject)
    this.extractPieceLength(torrentObject)
    this.infoPieces = torrentObject.info.pieces
    this.extractFilesInfo(torrentObject)
  }

  extractAnnounce(torrent) {
    if (Array.isArray(torrent['announce-list'])) {
      torrent['announce-list'].forEach((urls) =>
        urls.forEach((url) => this.announce.push(utility.decodeUint8Array(url)))
      )
    } else if (torrent.announce) {
      this.announce.push(utility.decodeUint8Array(torrent.announce))
    }
  }

  extractFilesInfo(torrent) {
    torrent.info.files.forEach((fileInfo) =>
      this.filesData.push({
        length: fileInfo.length,
        path: fileInfo.path.map(utility.decodeUint8Array),
      })
    )
  }

  extractInfoHash(torrent) {
    this.infoHash = crypto
      .createHash('sha1')
      .update(bencode.encode(torrent.info))
      .digest('hex')
    this.infoHashBuffer = crypto
      .createHash('sha1')
      .update(bencode.encode(torrent.info))
      .digest()
  }

  extractInfoName(torrent) {
    this.infoName = utility.decodeUint8Array(torrent.info.name)
  }

  extractInfoLength(torrent) {
    this.infoLength = torrent.info.files
      ? torrent.info.files
          .map((file) => BigInt(file.length))
          .reduce((sum, len) => sum + len)
      : BigInt(torrent.info.length)
  }

  extractPieceLength(torrent) {
    this.infoPieceLength = torrent['info']['piece length']
  }

  getPieceLength(pieceIndex) {
    const lastPieceLength = Number(this.infoLength) % this.infoPieceLength
    const lastPieceIndex = Math.floor(
      Number(this.infoLength) / this.infoPieceLength
    )
    return pieceIndex === lastPieceIndex
      ? lastPieceLength
      : this.infoPieceLength
  }

  getPieceBlockLength(pieceIndex, blockIndex) {
    const pieceLength = this.getPieceLength(pieceIndex)
    const lastPieceBlockLength = pieceLength % BLOCK_LENGTH
    const lastPieceBlockIndex = Math.floor(pieceLength / BLOCK_LENGTH)
    return blockIndex === lastPieceBlockLength
      ? lastPieceBlockIndex
      : BLOCK_LENGTH
  }

  getBlocksPerPiece(pieceIndex) {
    return Math.ceil(this.getPieceLength(pieceIndex) / BLOCK_LENGTH)
  }

  getPieceBlocks(pieceIndex) {
    const length = this.getBlocksPerPiece(pieceIndex)
    return Array.from({ length }, (_, i) => ({
      index: pieceIndex,
      begin: i * BLOCK_LENGTH,
      length: this.getPieceBlockLength(pieceIndex, i),
    }))
  }
}
