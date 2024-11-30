import UdpHandler from './udp.js'

export default class Tracker {
  config
  metadata
  url
  handler

  constructor(url, config, metadata) {
    // console.log(`url = ${url}`)
    this.config = config
    this.metadata = metadata
    this.url = new URL(url)
    this.handler = this.url.protocol === 'udp:' && new UdpHandler()
  }

  fetchPeers() {
    return new Promise((resolve) => {
      if (this.handler) {
        this.handler.handleConnection(
          this.url,
          this.config,
          this.metadata,
          (data, error) => {
            if (error) {
              console.log(
                `[ERROR_TRACKER] ${this.url.hostname}: ${error.message}`
              )
            }
            resolve(data?.peers || [])
          }
        )
      } else {
        console.log(
          `[ERROR_TRACKER] ${this.url.hostname}: Unsupported tracker protocol`
        )
        resolve([])
      }
    })
  }
}
