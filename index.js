import Client from './src/client/client.js'

const client = new Client()
const torrent = client.addTorrent('./files/2.torrent')

torrent.on('complete', () => {
  console.log('Torrent downloading completed!')
})
