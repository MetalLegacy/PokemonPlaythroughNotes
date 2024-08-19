let timer = null;

onmessage = (event) => {
	let data = event.data;
	if (!data) {
		stopTimer();
	} else {
		startTimer();
	}
}

function startTimer() {
	stopTimer();
	// time in milliseconds, so 1000 == one second
	timer = setTimeout(post, 2500);
}

function post(data) {
	postMessage(data);
}

function stopTimer() {
	clearTimeout(timer);
}