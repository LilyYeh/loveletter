let data = {
	domain: "http://lilyyeh.ga",
	port: 3000,
	path: "/loveLetter/project",
	title: "情書 桌遊",
	roomName: 'room1',
	userName: 'LilyYeh',
	showEnter:true,
}

let socket = io();
let vm = new Vue({
	el: "#enter",
	data: data,
	methods: {
		enterRoom() {
			socket.emit("join", {"roomID": this.roomName, "nickName": this.userName});
			window.location = this.domain+':'+this.port+'/waiting';
		},
	}
});

socket.on('Waiting', function(m) {
	console.log('Waiting');
	data.roomName = m.roomName;
	data.roomUsers = m.rs;
});