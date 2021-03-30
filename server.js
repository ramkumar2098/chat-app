const http = require('http')
const fs = require('fs')
const WebSocket = require('ws')

let rooms = []

const server = http.createServer((req, res) => {
  if (req.url == '/favicon.ico') return res.end()

  const sendFile = filename => {
    fs.readFile(filename, (err, data) => {
      if (err) {
        res.writeHead(404).write('404 page not found')
        res.end()
      } else {
        res.end(data)
      }
    })
  }

  if (req.url == '/' && rooms.length) {
    const openRoom = rooms.find(room => room.usersCount == 1)
    if (openRoom) {
      res.writeHead(302, {
        Location: '/' + openRoom.id,
      })
      res.end()
      return
    }
  }

  if (req.url === '/') {
    const roomId = uuid()
    rooms.push({ id: roomId, usersCount: 0, users: [] })
    res.writeHead(302, {
      Location: '/' + roomId,
    })
    res.end()
    return
  }

  const roomIndex = rooms.findIndex(room => room.id === req.url.slice(1))

  if (roomIndex !== -1) {
    if (rooms[roomIndex].usersCount === 2) {
      res.write('Room full')
      res.end()
      return
    }
    ++rooms[roomIndex].usersCount
    sendFile('index.html')
    return
  }

  if (!req.headers.referer) return res.end("Room does't exist")

  if (req.url === '/script.js') {
    sendFile('script.js')
    return
  }

  if (req.url === '/style.css') {
    sendFile('style.css')
    return
  }
})

server.listen(process.env.PORT || 8080)

const wss = new WebSocket.Server({ server })

wss.on('connection', socket => {
  let roomId
  let username

  socket.on('message', data => {
    data = JSON.parse(data)
    switch (data.type) {
      case 'NEW_USER':
        roomId = data.payload.roomId
        username = data.payload.username
        const index = rooms.findIndex(room => room.id === roomId)
        if (index === -1) return
        rooms[index].users.push(socket)
        if (rooms[index].users.length === 1) {
          const msg = 'wait for someone to join or send this link to someone'
          socket.send(emit('NEW_USER', { msg }))
          return
        }
        rooms[index].users
          .find(s => s !== socket)
          .send(emit('NEW_USER', { msg: username + ' has joined the chat' }))
        break
      case 'SAY_HELLO': {
        const index = rooms.findIndex(room => room.id === roomId)
        const _socket = rooms[index].users.find(s => s !== socket)
        _socket.send(emit('SAY_HELLO', { msg: `Say hello to ${username}!` }))
        break
      }
      case 'TYPING':
        const _index = rooms.findIndex(room => room.id === roomId)
        const _socket = rooms[_index].users.find(s => s !== socket)
        _socket?.send(
          emit('TYPING', {
            msg: username + ' is typing...',
            isTyping: data.payload.isTyping,
          })
        )
        break
      case 'NEW_MESSAGE':
        const room = rooms.find(room => room.id === roomId)
        room?.users.forEach(socket => socket.send(JSON.stringify(data)))
    }
  })

  socket.on('close', () => {
    const index = rooms.findIndex(room => room.id === roomId)
    if (index !== -1 && rooms[index].users.length === 2) {
      const _socket = rooms[index].users.find(s => s !== socket)
      _socket.send(emit('USER_LEFT', { msg: username + ' has left the chat' }))
    }
    rooms = rooms.filter(room => room.id !== roomId)
  })
})

const uuid = () => {
  return (Math.random() + Math.random()).toString().slice(2)
}

const emit = (type, payload) => {
  return JSON.stringify({ type, payload })
}
