let data = {
	roomName: 'room1',
	roomUsers: {},          //所有玩家
	showWaiting:true,
}

let socket = io();
let vm = new Vue({
	el: "#waiting",
	data: data,
	methods: {
		startGame() {
			socket.emit("start");
		},
	}
});

socket.on('Waiting', function(m) {
	console.log('Waiting');
	data.roomName = m.roomName;
	data.roomUsers = m.rs;
});