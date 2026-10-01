module.exports = (io, socket, db) => {
  console.log(`Socket connected: ${socket.id}`);

  // Join rooms based on role/ID (client should emit 'join' with their details after connecting)
  socket.on('join', (data) => {
    if (data.hospital_id) {
      socket.join(`hospital:${data.hospital_id}`);
    }
    if (data.ambulance_id) {
      socket.join(`ambulance:${data.ambulance_id}`);
    }
    if (data.role === 'admin') {
      socket.join('admin');
    }
  });

  socket.on('emergency:new', (data) => {
    socket.broadcast.emit('emergency:new', data);
  });

  socket.on('emergency:update', (data) => {
    socket.broadcast.emit('emergency:update', data);
  });

  socket.on('emergency:vitals', (data) => {
    socket.broadcast.emit('emergency:vitals', data);
  });

  socket.on('ambulance:location', (data) => {
    socket.broadcast.emit('ambulance:location', data);
  });

  socket.on('hospital:resource-update', (data) => {
    socket.broadcast.emit('hospital:resource-update', data);
  });

  socket.on('message:send', (data) => {
    socket.broadcast.emit('message:receive', data);
  });

  socket.on('transfer:request', (data) => {
    socket.broadcast.emit('transfer:request', data);
  });

  socket.on('transfer:response', (data) => {
    socket.broadcast.emit('transfer:response', data);
  });

  socket.on('doctor:status-change', (data) => {
    socket.broadcast.emit('doctor:status-change', data);
  });

  socket.on('hospital:status-change', (data) => {
    socket.broadcast.emit('hospital:status-change', data);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
};
