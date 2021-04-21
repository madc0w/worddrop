var letterHeight = 32; // height of capital letter = 24
var letterWidth = 30;
var sprintDuration = 180;
var ultraScoreTarget = 5000;
var vSpeed = parseFloat(localStorage.getItem("vSpeed")) || 1.2;
var gameEndDelay = 2000;
var nextLetterAnimTime = 600;

var wordScores = [ 0, 0, 0, 3, 8, 15, 30, 50, 80, 150, 250, 450, 800 ];

var canvas, completeWordsList, scoreSpan, switchLetterContainer, hiScoreContainer, togglePauseButton, timeContainer, modeLabel, popupInfo, nextLettersContainer;
var canvasCtx;
var state;
var maxHeight;
var mainIntervalId;
var didSwitch;
var isGameEnded;
var hiScores;
var animations;
var itNum;
var startTime;
var isPaused;
var pauseStart;
var pauseTime;
var recentLetters;
var nextLetters;
var gameEndTime;
var mode = localStorage.getItem("mode") || "marathon";
var info = {
	sprint : "Score as many points as you can in " + (sprintDuration / 60) + " minutes.",
	ultra : "Score " + ultraScoreTarget + " points as quickly as you can.  In this mode, your high score is your best time.",
	marathon : "Just continue playing for as long as you can!",
	scoringRules : "<div>Points are summed for each letter in a completed word.  The value of each letter is inversely proportional the its frequency of occurrence in the dictionary.<br/><br/>This total is then multiplied by a factor depending on the length of the word.</div>",
	resetHiscore : "<div>Are you sure you want to reset your high score?<br/><br/>There is no going back!</div><div><div class='button' onClick='resetHiscore();'>DO IT!</div><div class='button'>Never mind</div></div>",
};

var sounds = {
	letterInPlace : new Audio("sounds/click.mp3"),
	letterDrop : new Audio("sounds/boom1.mp3"),
	wordComplete : new Audio("sounds/boom2.mp3"),
	switchLetter : new Audio("sounds/switch.mp3"),
	gameOver : {
		sprint : new Audio("sounds/sprintEnd.mp3"),
		marathon : new Audio("sounds/game_over.mp3"),
		ultra : new Audio("sounds/ultraEnd.mp3"),
	}
};

//var letterNum = 0;
//var fixedLetters = "ctavista";
var fixedLetters = null;

function onLoad() {
	window.addEventListener("keydown", function(e) {
		// space and arrow keys
		if (e.key.startsWith("Arrow") || e.key == " ") {
			e.preventDefault();
		}
	}, false);

	canvas = $("#game-canvas")[0];
	completeWordsList = $("#complete-words-list");
	scoreSpan = $("#score")[0];
	switchLetterContainer = $("#switch-container");
	hiScoreContainer = $("#high-score")[0];
	togglePauseButton = $("#pause-play-button")[0];
	timeContainer = $("#time-container")[0];
	modeLabel = $("#mode-label")[0];
	popupInfo = $("#popup-info");
	nextLettersContainer = $("#next-letters-container");
	canvasCtx = canvas.getContext("2d");
	maxHeight = parseInt(canvas.height / letterHeight);

	info.scoringRules += "<div id='scoring-tables'>";
	info.scoringRules += "<table>";
	info.scoringRules += "<tr><th>Word Length</th><th>Factor</th></tr>";
	for ( var i in wordScores) {
		if (i >= 3) {
			info.scoringRules += "<tr><td>" + i + "</td><td>" + wordScores[i] + "</td></tr>";
		}
	}
	info.scoringRules += "</table>";

	info.scoringRules += "<table>";
	info.scoringRules += "<tr><th>Letter</th><th>Value</th><th>Frequency</th></tr>";
	for ( var letter in letterFreqs) {
		var points = (1 / letterFreqs[letter]).toFixed(1);
		var freq = (100 * letterFreqs[letter]).toFixed(2);
		info.scoringRules += "<tr><td>" + letter.toUpperCase() + "</td><td>" + points + "</td><td>" + freq + "%</td></tr>";
	}
	info.scoringRules += "</table>";
	info.scoringRules += "</div>";

	$("#speed-container input")[0].value = 50 + (vSpeed - 1.2) / 0.018;

	// to find letter size:
	//	canvasCtx.fillStyle = "#19aa5d";
	//	canvasCtx.strokeStyle = '#19aa5d';
	//	canvasCtx.fillText("W", 50, 50);
	//	canvasCtx.beginPath();
	//	canvasCtx.moveTo(50, 26);
	//	canvasCtx.lineTo(80, 26);
	//	canvasCtx.lineTo(80, 50);
	//	canvasCtx.stroke();

	init();
}

function onKeyDown(e) {
	if (isPaused) {
		return;
	}

	if (isGameEnded) {
		if (new Date() - gameEndTime > gameEndDelay) {
			init();
		}
	} else if (state.letter.letter) {
		if (e.key == "ArrowLeft") {
			if (state.letter.pos.x > 0) {
				state.letter.pos.x--;
			}
		} else if (e.key == "ArrowRight") {
			if (state.letter.pos.x < (canvas.width / letterWidth) - 2) {
				state.letter.pos.x++;
			}
		} else if (e.key == "Enter" || e.key == "ArrowUp") {
			if (!didSwitch) {
				stopSounds();
				sounds.switchLetter.play();

				didSwitch = true;

				var animId = parseInt(Math.random() * 100000000);
				animations[animId] = {
					callback : function() {
						var numSteps = 80;
						var step = itNum - animations[animId].start;

						var initX = animations[animId].initialPos.x * letterWidth;
						var x = initX + ((canvas.width - initX) * step / numSteps);
						var y = animations[animId].initialPos.y * (1 - (step / numSteps));
						canvasCtx.font = "bold " + letterHeight + "px Times";
						// 25, 170, 166 = #19aa5d
						canvasCtx.fillStyle = "rgba(25, 170, 166, " + (2 + Math.sin(60 * step / numSteps)) / 3 + ")";
						canvasCtx.fillText(animations[animId].letter, x, y);

						if (step >= numSteps) {
							delete animations[animId];
						}
					},
					start : itNum,
					initialPos : {
						x : state.letter.pos.x,
						y : state.letter.pos.y
					},
					letter : state.letter.letter.toUpperCase(),
				};

				var tmp = state.letter.letter;
				var switchLetter = switchLetterContainer.html();
				state.letter.letter = switchLetter.toLowerCase();
				switchLetterContainer.html(tmp.toUpperCase());
				state.letter.pos.y = 0;

				var switchAnimStep = 0;
				var switchAnimIntervalId = setInterval(function() {
					var shade = parseInt(255 * Math.sin(switchAnimStep * Math.PI / 20));
					switchLetterContainer.css("color", "rgba(" + shade + "," + shade + "," + shade + ", 1)");
					switchAnimStep++;
					if (switchAnimStep >= 20) {
						clearInterval(switchAnimIntervalId);
					}
				}, 60);
			}
		} else if (e.key == " " || e.key == "ArrowDown") {
			var yMax = 0;
			for ( var y in state.matrix) {
				y = parseInt(y);
				if (state.matrix[y][state.letter.pos.x]) {
					yMax = y + 1;
				}
			}

			if (e.key == "ArrowDown") {
				state.letter.pos.y += 10 * vSpeed;
				yMax = 1 + canvas.height - yMax * letterHeight;
				if (state.letter.pos.y > yMax) {
					state.letter.pos.y = yMax;
				}
			} else {
				if (!state.matrix[yMax]) {
					state.matrix[yMax] = [];
				}
				state.matrix[yMax][state.letter.pos.x] = state.letter.letter;
				stopSounds();
				sounds.letterDrop.play();
				testMatrix();
				setLetter(true);
			}
		}
	}
}

function mainLoop() {
	canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
	if (isPaused) {
		canvasCtx.fillStyle = "#19aa5d";
		canvasCtx.font = "bold 48px Arial";
		canvasCtx.fillText("PAUSED", 90, canvas.height / 2);
		canvasCtx.font = "bold 28px Arial";
		canvasCtx.fillText("No cheating!", 100, 60 + canvas.height / 2);
		return;
	}

	var secsElapsed = parseInt((new Date() - startTime - pauseTime) / 1000);
	if (mode == "sprint") {
		secsElapsed = sprintDuration - secsElapsed;
	}
	timeContainer.innerHTML = (mode == "sprint" && secsElapsed > 0 ? "-" : "") + formatTime(secsElapsed);

	drawMatrix();

	if (state.matrix.length > maxHeight || (mode == "sprint" && secsElapsed <= 0) || (mode == "ultra" && state.score >= ultraScoreTarget)) {
		clearInterval(mainIntervalId);
		isGameEnded = true;
		if (mode == "ultra" && (!hiScores[mode] || secsElapsed < hiScores[mode])) {
			hiScores[mode] = secsElapsed;
			localStorage.setItem("hiScores", JSON.stringify(hiScores));
			setHighScoreDisplay();
		}

		stopSounds();
		if (state.matrix.length > maxHeight) {
			sounds.gameOver.marathon.play();
		} else {
			sounds.gameOver[mode].play();
		}
		canvasCtx.fillStyle = "#19aa5d";
		canvasCtx.font = "bold 48px Arial";
		canvasCtx.fillText("GAME OVER", 50, canvas.height / 2);
		canvasCtx.font = "bold 28px Arial";
		gameEndTime = new Date();
		setTimeout(function() {
			canvasCtx.fillText("Hit any key to play again", 32, 60 + canvas.height / 2);
		}, gameEndDelay);
		return;
	}

	itNum++;
	var y = 0;
	var lineY = parseInt((canvas.height - state.letter.pos.y) / letterHeight);
	if (state.matrix[lineY] && state.matrix[lineY][state.letter.pos.x]) {
		y = lineY + 1;
		//		console.log("lineY", lineY);
	}
	//	console.log("lineY", lineY);
	//	console.log("y", y);
	if (state.letter.pos.y >= canvas.height - y * letterHeight) {
		if (!state.matrix[y]) {
			state.matrix[y] = [];
		}
		stopSounds();
		sounds.letterInPlace.play();
		state.matrix[y][state.letter.pos.x] = state.letter.letter;
		testMatrix();
		setLetter(true);
	}

	drawLetter(state.letter.letter, state.letter.pos.x, state.letter.pos.y);
	var beamX = 2 + state.letter.pos.x * letterWidth;
	var yMax = 0;
	for ( var y in state.matrix) {
		if (state.matrix[y][state.letter.pos.x]) {
			yMax = y;
		}
	}
	if (yMax) {
		yMax++;
	}
	var gradient = canvasCtx.createLinearGradient(beamX, state.letter.pos.y, beamX + letterWidth, state.letter.pos.y);
	// 25, 170, 166 = #19aa5d
	gradient.addColorStop(0, "rgba(25, 170, 166, 0)");
	gradient.addColorStop(0.5, "rgba(25, 170, 166, 0.6)");
	gradient.addColorStop(1, "rgba(25, 170, 166, 0)");
	canvasCtx.fillStyle = gradient;
	canvasCtx.fillRect(beamX, state.letter.pos.y + 4, letterWidth, canvas.height - state.letter.pos.y - (yMax * letterHeight));

	for ( var animId in animations) {
		animations[animId].callback();
	}

	state.letter.pos.y += vSpeed;
}

function testMatrix() {
	var didCompleteWord;
	do {
		didCompleteWord = false;

		// find horizontal words
		for ( var y in state.matrix) {
			y = parseInt(y);
			var longestWord = "";
			var longestWordStartX = 0;
			for ( var x in state.matrix[y]) {
				x = parseInt(x);
				if (state.matrix[y][x]) {
					var node = wordTree;
					var buildingWord = "";
					var word = buildingWord;
					while (state.matrix[y][x + buildingWord.length] && node) {
						var letter = state.matrix[y][x + buildingWord.length];
						node = node[letter];
						buildingWord += letter;
						if (node && node.$) {
							word = buildingWord;
						}
					}
					if (word.length > longestWord.length) {
						longestWord = word;
						longestWordStartX = x;
					}
				}
			}
			if (longestWord) {
				didCompleteWord = true;
				var x2 = longestWordStartX + longestWord.length;
				completeWord(longestWord, longestWordStartX, y, x2, y);
				for (var x3 = longestWordStartX; x3 < x2; x3++) {
					inner: for (var y2 = y; y2 < maxHeight; y2++) {
						var letterAbove = state.matrix[y2 + 1] ? state.matrix[y2 + 1][x3] : null;
						state.matrix[y2][x3] = letterAbove;
						if (!state.matrix[y2 + 1]) {
							break inner;
						}
					}
				}
			}
		}

		// find vertical words
		for (var y = state.matrix.length - 1; y >= 0; y--) {
			y = parseInt(y);
			for ( var x in state.matrix[y]) {
				x = parseInt(x);
				if (state.matrix[y][x]) {
					var node = wordTree;
					var buildingWord = "";
					var word = buildingWord;
					while (state.matrix[y - buildingWord.length] && state.matrix[y - buildingWord.length][x] && node) {
						var letter = state.matrix[y - buildingWord.length][x];
						node = node[letter];
						buildingWord += letter;
						if (node && node.$) {
							word = buildingWord;
						}
					}
					if (word) {
						didCompleteWord = true;
						var y2 = y - word.length;
						completeWord(word, x, y2 + 1, x, y);
						for (var y3 = y2 + 1; y3 <= y; y3++) {
							state.matrix[y3][x] = null;
						}
						for (var i = 0; i < maxHeight; i++) {
							if (state.matrix[y3 + i]) {
								state.matrix[y2 + 1 + i][x] = state.matrix[y3 + i][x];
							} else if (state.matrix[y2 + 1 + i]) {
								state.matrix[y2 + 1 + i][x] = null;
							}
						}
					}
				}
			}
		}

		if (didCompleteWord) {
			drawMatrix();
		}
	} while (didCompleteWord);
}

function drawMatrix() {
	for ( var y in state.matrix) {
		y = parseInt(y);
		for ( var x in state.matrix[y]) {
			x = parseInt(x);
			var letter = state.matrix[y][x];
			drawLetter(letter, x, canvas.height - (y * letterHeight));
		}
	}
}

function setLetter(isAnimating) {
	didSwitch = false;
	if (fixedLetters) {
		state.letter.letter = fixedLetters.charAt(letterNum++);
		state.letter.pos = {
			x : parseInt(canvas.width / (2 * letterWidth)),
			y : 0
		};
	} else {
		state.letter.letter = nextLetters.pop();
		for (var i = nextLetters.length; i > 0; i--) {
			nextLetters[i] = nextLetters[i - 1];
		}
		nextLetters[0] = getRandomLetter();
		recentLetters.splice(0, 1);

		if (isAnimating) {
			$("#next-letters-container .last").fadeOut(nextLetterAnimTime, function() {
				setNextLetters(true);
			});
		} else {
			setNextLetters(false);
		}

		state.letter.pos = {
			x : parseInt(canvas.width / (2 * letterWidth)),
			y : 0
		};
	}
}

function getRandomLetter() {
	var letters = Object.keys(letterFreqs);
	var letter;
	do {
		var rand = Math.random();
		var sum = 0;
		for ( var i in letters) {
			sum += letterFreqs[letters[i]];
			if (sum >= rand) {
				letter = letters[i];
				break;
			}
		}
	} while (recentLetters.includes(letter) && !fixedLetters);
	recentLetters.push(letter);
	while (recentLetters.length > 2) {
		recentLetters.splice(0, 1);
	}
	//	console.log("recentLetters", recentLetters);
	return letter;
}

function completeWord(word, x1, y1, x2, y2) {
	stopSounds();
	sounds.wordComplete.play();

	var animId = parseInt(Math.random() * 100000000);
	animations[animId] = {
		callback : function() {
			var numSteps = 120;
			var step = itNum - animations[animId].start;
			//			console.log("*** step", step);
			//			console.log("word", word);
			for ( var i in word) {
				i = parseInt(i);
				var x, y;
				if (x1 == x2) {
					x = x1;
					y = y2 - i;
				} else {
					x = x1 + i;
					y = y1;
				}
				var factor = Math.pow(step, 0.06);
				canvasCtx.font = "bold " + (letterHeight / factor) + "px Times";
				// 25, 170, 166 = #19aa5d
				canvasCtx.fillStyle = "rgba(25, 170, 166, " + (1 - (step / numSteps)) + ")";
				var ch = word.charAt(i).toUpperCase();
				//				console.log("ch", ch);
				canvasCtx.fillText(ch, x * letterWidth + (2 * factor), canvas.height - y * letterHeight);
				//				console.log("x y ", x, y);
			}
			if (step >= numSteps) {
				delete animations[animId];
			}
		},
		start : itNum,
	};

	scoreInc = 0;
	for ( var i in word) {
		scoreInc += 1 / letterFreqs[word.charAt(i)];
	}
	scoreInc *= wordScores[word.length];
	state.score += scoreInc;
	scoreSpan.innerHTML = parseInt(state.score);

	var newLine = "<tr><td><a href=\"https://www.merriam-webster.com/dictionary/" + word + "\" target=\"definition\" onClick=\"wordClick();\">"
		+ word + "</a></td><td>" + parseInt(scoreInc) + "</td></tr>"
	completeWordsList.html(newLine + completeWordsList.html());

	if (!hiScores || !hiScores[mode] || state.score > hiScores[mode]) {
		if (mode != "ultra") {
			hiScores[mode] = state.score;
		}
		localStorage.setItem("hiScores", JSON.stringify(hiScores));
		setHighScoreDisplay();
	}
}

function init() {
	if (isPaused) {
		togglePause();
	}
	recentLetters = [];
	nextLetters = [];
	for (var i = 0; i < 3; i++) {
		var letter = getRandomLetter();
		nextLetters.push(letter);
	}
	setNextLetters();

	itNum = 0;
	pauseTime = 0;
	startTime = new Date();
	animations = {};
	state = {
		letter : {
			letter : null,
			pos : {
				x : 0,
				y : 0
			},
		},
		matrix : [],
		score : 0,
	};
	hiScores = JSON.parse(localStorage.getItem("hiScores")) || {
		marathon : 0,
		sprint : 0,
		ultra : null,
	};

	completeWordsList.html(null);
	switchLetterContainer.html(getRandomLetter().toUpperCase());

	didSwitch = false;
	isGameEnded = false;
	setLetter(false);
	scoreSpan.innerHTML = 0;

	setHighScoreDisplay();
	if (mainIntervalId) {
		clearInterval(mainIntervalId);
	}
	mainIntervalId = setInterval(mainLoop, 20);

	var modes = [ "ultra", "sprint", "marathon" ];
	for ( var i in modes) {
		$("#" + modes[i] + "-mode-button").removeClass("selected");
	}
	$("#" + mode + "-mode-button").addClass("selected");
	modeLabel.innerHTML = mode.toUpperCase();

	//	state.matrix = [ //
	//	[ null, null, "x", "d", "x", "x" ], // 
	//	[ null, null, "x", "e", "x", "x" ], // 
	//	[ null, null, "x", "t", "x", "x" ], // 
	//	[ null, null, "x", "i", "x", "x" ], // 
	//	[ null, null, "x", "n", "x", "x" ], // 
	//	[ null, null, "d", "o", null, "e" ], // 
	//	[ null, null, null, "u", null, null ], // 
	//	[ null, null, null, "e", null, null ], // 
	//	[ null, null, null, "r", null, null ], // 
	//	//	[ null, null, "r", "e", "u", null, "i", "t", "e", "d" ], // 
	//	//	[ null, null, null, null, "d" ], // 
	//	//	[ null, null, null, null, "e" ], // 
	//	//	[ null, null, null, null, "t" ], // 
	//	//	[ null, null, null, null, "i" ], // 
	//	//	[ null, null, null, null, "n" ], // 
	//	//	[ null, null, null, null, "u" ], // 
	//	//	[ null, null, null, null, "e" ], // 
	//	];
}

function stopSounds() {
	for ( var sound in sounds) {
		if (sound != "gameOver") {
			sounds[sound].pause();
			sounds[sound].currentTime = 0;
		}
	}
	for ( var sound in sounds.gameOver) {
		sounds.gameOver[sound].pause();
		sounds.gameOver[sound].currentTime = 0;
	}
}

function speedChnaged(e) {
	vSpeed = 1.2 + 1.8 * ((e.value - 50) / 100);
	localStorage.setItem("vSpeed", vSpeed);
}

function togglePause() {
	isPaused = !isPaused;
	if (isPaused) {
		pauseStart = new Date();
	} else {
		pauseTime += new Date() - pauseStart;
	}
	togglePauseButton.innerHTML = (isPaused ? "GO" : "Pause");
	stopSounds();
	sounds.switchLetter.play();
}

function wordClick() {
	if (!isPaused) {
		togglePause();
	}
}

function setMode(_mode) {
	mode = _mode;
	localStorage.setItem("mode", mode);
	modeLabel.innerHTML = mode.toUpperCase();
	init();
}

function resetHiscore() {
	hiScores[mode] = mode == "ultra" ? null : 0;
	localStorage.setItem("hiScores", JSON.stringify(hiScores));
	setHighScoreDisplay();
}

function pad(str, padding) {
	var i = 0;
	while (str.toString().length < padding.length) {
		str = padding.charAt(i++) + str;
	}
	return str;
}

function formatTime(secs) {
	var minutes = parseInt(secs / 60);
	return minutes + ":" + (pad(secs - (60 * minutes), "00"));
}

function setHighScoreDisplay() {
	var hiScore = hiScores[mode] && parseInt(hiScores[mode]);
	if (hiScore) {
		hiScoreContainer.innerHTML = mode == "ultra" ? formatTime(hiScore) : hiScore;
	} else {
		hiScoreContainer.innerHTML = "--";
	}
}

function showInfo(element, type, cssClass) {
	var rect = element.getBoundingClientRect();
	popupInfo.html(info[type]);
	var top = rect.top + 40 + window.scrollY;
	popupInfo.css("top", top + "px");
	popupInfo.css("left", (rect.left + 12) + "px");
	popupInfo.fadeIn();
	if (cssClass) {
		popupInfo.addClass(cssClass);
	} else {
		popupInfo.removeClass();
	}
}

function hideInfo() {
	popupInfo.hide();
	popupInfo.html(null);
}

function drawLetter(letter, x, y) {
	if (letter) {
		canvasCtx.fillStyle = "rgba(255, 255, 255, 0.3)";
		roundRect(canvasCtx, 4 + x * letterWidth, y - letterHeight + 4, letterWidth - 2, letterHeight - 3, 12, true);

		canvasCtx.font = "bold " + (letterHeight - 8) + "px Times";
		canvasCtx.fillStyle = "#fff";
		var letterX = 9 + x * letterWidth;
		if (letter.toUpperCase() == "I") {
			letterX += 4;
		} else if ([ "W", "M" ].includes(letter.toUpperCase())) {
			letterX -= 2;
		}
		canvasCtx.fillText(letter.toUpperCase(), letterX, y - 4);
	}
}

function setNextLetters(isAnimating) {
	var html = "";
	for ( var i in nextLetters) {
		var letter = nextLetters[i];
		var className = null;
		if (i == nextLetters.length - 1) {
			className = "last";
		}
		html += "<div " + (className ? "class=\"" + className + "\"" : "") + ">" + letter.toUpperCase() + "</div>";
	}
	if (isAnimating) {
		var nextLettersContainerMargin = -22;
		var f = function() {
			nextLettersContainer.css("margin-left", nextLettersContainerMargin + "px");
			nextLettersContainerMargin++;
			if (nextLettersContainerMargin > 2) {
				clearInterval(nextLetterAnimIntervalId);
			}
		};
		var nextLetterAnimIntervalId = setInterval(f, 40);
		f();
	}
	nextLettersContainer.html(html);
}

/**
 * Draws a rounded rectangle using the current state of the canvas.
 * If you omit the last three params, it will draw a rectangle
 * outline with a 4 pixel border radius
 * 
 * @param {CanvasRenderingContext2D} ctx
 * @param {Number} x The top left x coordinate
 * @param {Number} y The top left y coordinate
 * @param {Number} width The width of the rectangle
 * @param {Number} height The height of the rectangle
 * @param {Number} [radius = 4] The corner radius; It can also be an object 
 *                 to specify different radii for corners
 * @param {Number} [radius.tl = 0] Top left
 * @param {Number} [radius.tr = 0] Top right
 * @param {Number} [radius.br = 0] Bottom right
 * @param {Number} [radius.bl = 0] Bottom left
 * @param {Boolean} [fill = false] Whether to fill the rectangle.
 * @param {Boolean} [stroke = true] Whether to stroke the rectangle.
 */
function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
	if (typeof stroke == "undefined") {
		stroke = true;
	}
	if (typeof radius === "undefined") {
		radius = 4;
	}
	if (typeof radius === "number") {
		radius = {
			tl : radius,
			tr : radius,
			br : radius,
			bl : radius
		};
	} else {
		var defaultRadius = {
			tl : 0,
			tr : 0,
			br : 0,
			bl : 0
		};
		for ( var side in defaultRadius) {
			radius[side] = radius[side] || defaultRadius[side];
		}
	}
	ctx.beginPath();
	ctx.moveTo(x + radius.tl, y);
	ctx.lineTo(x + width - radius.tr, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
	ctx.lineTo(x + width, y + height - radius.br);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
	ctx.lineTo(x + radius.bl, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
	ctx.lineTo(x, y + radius.tl);
	ctx.quadraticCurveTo(x, y, x + radius.tl, y);
	ctx.closePath();
	if (fill) {
		ctx.fill();
	}
	if (stroke) {
		ctx.stroke();
	}
}
