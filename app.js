let xp = localStorage.getItem("xp") || 0;

function updateDisplay() {
  document.getElementById("xpDisplay").innerText = "XP: " + xp;
}

function addXP() {
  let input = document.getElementById("xpInput").value;
  xp = parseInt(xp) + parseInt(input || 0);

  localStorage.setItem("xp", xp);
  updateDisplay();

  document.getElementById("xpInput").value = "";
}

updateDisplay();