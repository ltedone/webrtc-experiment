//sezione server web
var app = require('http').createServer(handler),
    io = require('socket.io').listen(app),
    static = require('node-static'); //permette di servire le pagine web

//Rende accessibili tutti i file presenti nella cartella corrente
var fileServer = new static.Server('./');

app.listen(process.env.VCAP_APP_PORT || 8080);

io.configure('development', function(){
  io.set('transports', ['xhr-polling']);
});


function handler (request, response) { 
  request.addListener('end', function () { 
    fileServer.serve(request, response); // restituisce il file corretto
  }); 
}


// Imposto Socket.io
io.sockets.on('connection', function(socket) {

  console.log((new Date()) + ' Connessione stabilita.');

  // Quando un utente invia un messaggio SDP
  // tale messaggio viene inviato a tutti gli altri utenti in ascolto
  socket.on('message', function(message) {
    console.log((new Date()) + ' Messaggio ricevuto, trametto in broadcast: ' + message);
    socket.broadcast.emit('message', message);
  });

  // Quando un utente chiude la chiamata
  // viene inviato il segnale di bye a tutti gli utenti in ascolto
  socket.on('disconnect', function() {
    // chiudo la connessione dell'utente
    console.log((new Date()) + " Peer disconnesso.");
    socket.broadcast.emit('user disconnected');
  });

});

