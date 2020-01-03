interface Player {
  name: String,
  score: number,
}

export function sortPlayers(player1 : Player, player2 : Player) : number {
  let score1 = player1.score;
  let score2 = player2.score;
  if (score1 < score2) {
    return 1;
  } else if (score1 > score2) {
    return -1;
  } else {
    return 0;
  }

}

export default Player;
