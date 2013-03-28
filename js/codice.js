//creo la socket
var socket = io.connect();

var sourcevid = document.getElementById('webrtc-sourcevid');
var remotevid = document.getElementById('webrtc-remotevid');
var avviaVideo = document.getElementById('avviaVideo');
var fermaVideo = document.getElementById('fermaVideo');
var avviaChiamata = document.getElementById('avviaChiamata');
var fermaChiamata = document.getElementById('fermaChiamata');
var localStream = null;
var peerConn = null;
var avviata = false;
var canalePronto = false;
var mediaConstraints = {
	'mandatory' : {
		'OfferToReceiveAudio' : true,
		'OfferToReceiveVideo' : true
	}
};

// socket: canale connesso
socket.on('connect', onCanaleAperto).on('message', onMessaggio);

function onCanaleAperto(evt) {
	console.log('Canale aperto.');
	canalePronto = true;
}

// socket: accetta la richiesta di connessione
function onMessaggio(evt) {
	if (evt.type === 'offer') {
		console.log("Ricezione offerta in corso...")
		if (!avviata) {
			creaPeerConnection();
			avviata = true;
		}
		console.log('Creo la remote session description...');
		peerConn.setRemoteDescription(new RTCSessionDescription(evt));
		console.log('Invio la risposta...');
		peerConn.createAnswer(impostaLocaleEdInviaMessaggio, creazioneRispostaFallita, mediaConstraints);

	} else if (evt.type === 'answer' && avviata) {
		console.log('Ricevo la risposta...');
		console.log('Imposto la remote session description...');
		peerConn.setRemoteDescription(new RTCSessionDescription(evt));

	} else if (evt.type === 'candidate' && avviata) {
		console.log('Ricevo il candidato ICE...');
		var candidate = new RTCIceCandidate({
			sdpMLineIndex : evt.sdpMLineIndex,
			sdpMid : evt.sdpMid,
			candidate : evt.candidate
		});
		console.log(candidate);
		peerConn.addIceCandidate(candidate);

	} else if (evt.type === 'bye' && avviata) {
		console.log("Ricevuto bye");
		avviaChiamata.removeAttribute("disabled");
		fermaChiamata.setAttribute("disabled", "disabled");
		stop();
	}
}

function creazioneRispostaFallita() {
	console.log("Creazione della risposta fallita.");
}

// Avvio il video locale
function startVideo() {
	navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || window.navigator.mozGetUserMedia;
	window.URL = window.URL || window.webkitURL;

	navigator.getUserMedia({
		video : true,
		audio : true
	}, successCallback, errorCallback);
	function successCallback(stream) {
		localStream = stream;
		avviaVideo.setAttribute("disabled", "disabled");
		fermaVideo.removeAttribute("disabled");
		if (navigator.mozGetUserMedia) {
			sourcevid.mozSrcObject = stream;
			sourcevid.play();
		} else {
			try {
				sourcevid.src = window.URL.createObjectURL(stream);
				sourcevid.play();
			} catch(e) {
				console.log("Errore nell'impostazione della sorgente video: ", e);
			}
		}
	}

	function errorCallback(error) {
		console.error('Si è verificato un errore: [CODICE ' + error.code + ']');
		return;
	}

}

// fermo il video locale
function stopVideo() {
	if (sourcevid.mozSrcObject) {
		sourcevid.mozSrcObject.stop();
		sourcevid.src = null;
	} else {
		sourcevid.src = "";
		localStream.stop();
	}
}

// invio SDP attraverso la socket
function impostaLocaleEdInviaMessaggio(sessionDescription) {
	peerConn.setLocalDescription(sessionDescription);
	console.log("Invio: SDP");
	console.log(sessionDescription);
	socket.json.send(sessionDescription);
}

// inizio la connessione alla richiesta dell'utente
function connect() {
	if (!avviata && localStream && canalePronto) {
		creaPeerConnection();
		avviata = true;
		peerConn.createOffer(impostaLocaleEdInviaMessaggio, creazioneOffertaFallita, mediaConstraints);
	} else {
		alert("Lo stream video locale non è ancora attivo. Riprova");
	}
}

function creazioneOffertaFallita() {
	console.log("Creazione della risposta fallita.");
}

// fermo la connessione alla richiesta dell'utente
function chiudi() {
	console.log("Chiamata chiusa.");
	socket.json.send({
		type : "bye"
	});
	avviaChiamata.removeAttribute("disabled");
	fermaChiamata.setAttribute("disabled", "disabled");
	stop();
}

function stop() {
	peerConn.close();
	peerConn = null;
	avviata = false;
}

function creaPeerConnection() {
	console.log("Creo la peer connection");
	RTCPeerConnection = webkitRTCPeerConnection || mozRTCPeerConnection;
	var pc_config = {
		"iceServers" : [{"url":"stun:stun.ekiga.net"},{"url":"stun:stun.voipstunt.com"},{"url":"stun:stun.l.google.com:19302"}]
	};
	try {
		peerConn = new RTCPeerConnection(pc_config);
	} catch (e) {
		console.log("Creazione della PeerConnection fallita, errore: " + e.message);
	}
	// invio qualsiasi candidato ICE agli altri peer
	peerConn.onicecandidate = function(evt) {
		if (event.candidate) {
			console.log('Invio il candidato ICE...');
			console.log(evt.candidate);
			socket.json.send({
				type : "candidate",
				sdpMLineIndex : evt.candidate.sdpMLineIndex,
				sdpMid : evt.candidate.sdpMid,
				candidate : evt.candidate.candidate
			});
		} else {
			console.log("Fine dei candidati.");
		}
	};
	console.log('Aggiungo lo stream locale...');
	peerConn.addStream(localStream);

	peerConn.addEventListener("addstream", onStreamRemotoAggiunto, false);
	peerConn.addEventListener("removestream", onStreamRemotoRimosso, false)

	// quando l'utente remoto aggiunge uno stream, esso viene passato all'elemento video locale
	function onStreamRemotoAggiunto(event) {
		console.log("Stream remoto aggiunto");
		remotevid.src = window.URL.createObjectURL(event.stream);
		avviaChiamata.setAttribute("disabled", "disabled");
		fermaChiamata.removeAttribute("disabled");
	}

	// quando l'utente remototo rimuove uno stream, esso viene rimosso dall'elemento video locale
	function onStreamRemotoRimosso(event) {
		console.log("Stream remoto rimosso");
		remotevid.src = "";
	}
}
