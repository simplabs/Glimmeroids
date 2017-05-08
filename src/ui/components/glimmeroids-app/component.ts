import Component, { tracked } from '@glimmer/component';
import Asteroid from '../../../utils/asteroid';
import Bullet from '../../../utils/bullet';
import { Entity } from '../../../utils/entity';
import { randomNumBetweenExcluding } from '../../../utils/helper';
import Particle from '../../../utils/Particle';
import Ship from '../../../utils/ship';
import Player, { sortPlayers } from '../../../utils/player';

const KEY = {
  LEFT:  37,
  RIGHT: 39,
  UP: 38,
  A: 65,
  D: 68,
  W: 87,
  SPACE: 32,
  ENTER: 13,
  ZERO: 48,
};

const INITIAL_ASTEROID_COUNT = 5;

const TOP_SCORES_COUNT = 5;

enum GameState {
  Welcome = 0,
  Running,
  GameOver,
}

const PRIZE_THRESHOLD = 3000;
const TOP_SCORERS_STORAGE_KEY = 'glimmeroids:topScorers';

export interface GlimmeroidsState {
  screen: {
    width: number,
    height: number,
    ratio: number
  };
  context: CanvasRenderingContext2D;
  keys: {
    left: Boolean,
    right: Boolean,
    up: Boolean,
    down: Boolean,
    space: Boolean
  };
  asteroidCount: number;
  currentScore: number;
  topScorers: Player[];
  gameState: GameState;
  destroyAsteroids: Boolean;
  shouldSubmitTopScorerName: Boolean;
}

export default class Glimmeroids extends Component {
  @tracked state: GlimmeroidsState;
  ship: Ship[];
  asteroids: Asteroid[];
  bullets: Bullet[];
  particles: Particle[];
  @tracked _players: Player[];
  @tracked newTopScorerName: string;

  PRIZE_THRESHOLD = PRIZE_THRESHOLD;
  GameState = GameState;

  constructor(options: object) {
    super(options);

    this._players = this._initPlayers();

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp   = this.handleKeyUp.bind(this);
    this.handleResize  = this.handleResize.bind(this);

    this.state = {
      screen: {
        width: window.innerWidth,
        height: window.innerHeight,
        ratio: window.devicePixelRatio || 1,
      },
      context: null,
      keys : {
        left  : false,
        right : false,
        up    : false,
        down  : false,
        space : false
      },
      asteroidCount: INITIAL_ASTEROID_COUNT,
      currentScore: 0,
      topScorers: this.topScorers,
      gameState: GameState.Welcome,
      destroyAsteroids: false,
      shouldSubmitTopScorerName: false
    };
    this.ship = [];
    this.asteroids = [];
    this.bullets = [];
    this.particles = [];
  }

  @tracked('state', 'firstTopScore')
  get gameOverMessage() {
    if (this.state.currentScore <= 0) {
      return '0 points... So sad.';
    } else if (this.state.currentScore >= this.firstTopScore) {
      return 'New top score with ' + this.state.currentScore + ' points. Woo!';
    } else {
      return this.state.currentScore + ' Points though :)';
    }
  }

  @tracked('state')
  get isPrizeWinner() {
    return this.state.currentScore >= PRIZE_THRESHOLD;
  }

  @tracked('_players')
  get topScorers() : Player[] {
    let sortedPlayers:Player[] =  this._players.sort(sortPlayers)
    return sortedPlayers.slice(0, TOP_SCORES_COUNT);
  }

  @tracked('topScorers')
  get firstTopScore() {
    let len = this.topScorers.length;
    return len ? this.topScorers[0].score : 0;
  }

  @tracked('topScorers')
  get lastTopScore() {
    let len = this.topScorers.length;
    return len ? this.topScorers[len-1].score : 0;
  }

  @tracked('state')
  get canvasSize() {
    return {
      width: this.state.screen.width * this.state.screen.ratio,
      height: this.state.screen.height * this.state.screen.ratio
    };
  }

  _initPlayers() {
    let storedTopScorers:string = localStorage.getItem(TOP_SCORERS_STORAGE_KEY);
    let topScorers:Player[] = storedTopScorers ? JSON.parse(storedTopScorers) : [];
    return topScorers;
  }

  handleResize() {
    this.state = {
      ...this.state,
      screen: {
        width: window.innerWidth,
        height: window.innerHeight,
        ratio: window.devicePixelRatio || 1,
      }
    };
  }

  handleKeyUp(event: KeyboardEvent) {
    this.handleKeys(false, event);
  }

  handleKeyDown(event: KeyboardEvent) {
    this.handleKeys(true, event);
  }

  handleKeys(value: Boolean, event: KeyboardEvent) {
    if (this.state.gameState !== GameState.Running && event.keyCode === KEY.ENTER && !value) {
      this.startGame();
    }

    let keys = this.state.keys;
    if (event.keyCode === KEY.LEFT   || event.keyCode === KEY.A) { keys.left  = value; }
    if (event.keyCode === KEY.RIGHT  || event.keyCode === KEY.D) { keys.right = value; }
    if (event.keyCode === KEY.UP     || event.keyCode === KEY.W) { keys.up    = value; }
    if (event.keyCode === KEY.SPACE) { keys.space = value; }
    if (event.keyCode === KEY.ZERO)  {
      this.state.destroyAsteroids = true;
    }

    this.state = {
      ...this.state,
      keys
    };
  }

  didInsertElement() {
    window.addEventListener('keyup',   this.handleKeyUp);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('resize',  this.handleResize);

    const context = (this.element as HTMLElement).querySelector('canvas').getContext('2d');
    this.state = {
      ...this.state,
      context
    };
    requestAnimationFrame(() => this.update());
  }

  willDestroy() {
    window.removeEventListener('keyup',   this.handleKeyUp);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('resize',  this.handleResize);
  }

  update() {
    const context = this.state.context;

    context.save();
    context.scale(this.state.screen.ratio, this.state.screen.ratio);

    // Motion trail
    context.fillStyle = '#000';
    context.globalAlpha = 0.4;
    context.fillRect(0, 0, this.state.screen.width, this.state.screen.height);
    context.globalAlpha = 1;

    // Next set of asteroids
    if (!this.asteroids.length) {
      let count = this.state.asteroidCount + 2;

      this.state = {
        ...this.state,
        asteroidCount: count
      };
      this.generateAsteroids(count);
    }

    // Check for colisions
    this.checkCollisionsWith(this.bullets, this.asteroids);
    this.checkCollisionsWith(this.ship, this.asteroids);

    // Remove or render
    this.updateObjects(this.particles, 'particles');
    this.updateObjects(this.asteroids, 'asteroids');
    this.updateObjects(this.bullets, 'bullets');
    this.updateObjects(this.ship, 'ship');

    if (this.state.destroyAsteroids) {
      this.state.destroyAsteroids = false;
      this.state = {
        ...this.state,
        asteroidCount: 0
      };
    }

    context.restore();

    // Next frame
    requestAnimationFrame(() => this.update());
  }

  addScore(points: number) {
    if (this.state.gameState === GameState.Running) {
      this.state = {
        ...this.state,
        currentScore: this.state.currentScore + points
      };
    }
  }

  startGame() {
    this.state = {
      ...this.state,
      gameState: GameState.Running,
      currentScore: 0,
      asteroidCount: INITIAL_ASTEROID_COUNT
    };

    // Make ship
    let ship = new Ship({
      position: {
        x: this.state.screen.width / 2,
        y: this.state.screen.height / 2
      },
      create: this.createObject.bind(this),
      onDie: this.gameOver.bind(this)
    });
    this.createObject(ship, 'ship');

    // Make asteroids
    this.asteroids = [];
    this.generateAsteroids(this.state.asteroidCount);
  }

  gameOver() {
    let newScore = this.state.currentScore;
    if (newScore > this.lastTopScore) {
      this.state = {
        ...this.state,
        gameState: GameState.GameOver,
        shouldSubmitTopScorerName: true
      };
    } else {
      this.state = {
        ...this.state,
        gameState: GameState.GameOver
      };
    }
  }

  updatePlayerName(event : KeyboardEvent) {
    this.newTopScorerName = event.target.value;
  }

  submitTopScorerName(event : KeyboardEvent) {
    if (!this.newTopScorerName.trim()) {
      return;
    }
    let newScore = this.state.currentScore;
    let newPlayer = { name: this.newTopScorerName, score: newScore };
    //NOTE: There is a meta tag in an item of this._players which might
    // cause the JSON serialization error
    let noMetaTagPlayers = this._players.map(({ name, score }) => {
      return { name, score };
    });
    this._players = [...noMetaTagPlayers, newPlayer];
    localStorage.setItem(TOP_SCORERS_STORAGE_KEY, JSON.stringify(this.topScorers));
    this.newTopScorerName = '';
    this.state = {
      ...this.state,
      shouldSubmitTopScorerName: false,
    }
  }

  generateAsteroids(amount: number) {
    let ship = this.ship[0];
    let shipPosition = ship ? ship.position : {
      x: this.state.screen.width / 2,
      y: this.state.screen.height / 2
    };

    for (let i = 0; i < amount; i++) {
      let asteroid = new Asteroid({
        size: 80,
        position: {
          x: randomNumBetweenExcluding(0, this.state.screen.width, shipPosition.x - 60, shipPosition.x + 60),
          y: randomNumBetweenExcluding(0, this.state.screen.height, shipPosition.y - 60, shipPosition.y + 60)
        },
        create: this.createObject.bind(this),
        addScore: this.addScore.bind(this)
      });
      this.createObject(asteroid, 'asteroids');
    }
  }

  createObject(item: Entity, group: 'asteroids' | 'ship' | 'particles' | 'bullets') {
    if (group === 'asteroids') {
      this.asteroids.push(item as Asteroid);
    } else if (group === 'ship') {
      this.ship.push(item as Ship);
    } else if (group === 'particles') {
      this.particles.push(item as Particle);
    } else if (group === 'bullets') {
      this.bullets.push(item as Bullet);
    }
  }

  updateObjects(items: Entity[], group: 'asteroids' | 'ship' | 'particles' | 'bullets') {
    for (let i = 0; i < items.length; i++) {
      let item = items[i];
      if (item.delete) {
        this[group].splice(i, 1);
      } else {
        item.render(this.state);
      }
    }
  }

  checkCollisionsWith(items1: Entity[], items2: Entity[]) {
    for (let a = 0; a < items1.length; a++) {
      let item1 = items1[a];
      for (let b = 0; b < items2.length; b++) {
        let item2 = items2[b];
        if (this.checkCollision(item1, item2)) {
          item1.destroy();
          item2.destroy();
        }
      }
    }
  }

  checkCollision(obj1: Entity, obj2: Entity): boolean {
    let vx = obj1.position.x - obj2.position.x;
    let vy = obj1.position.y - obj2.position.y;
    let length = Math.sqrt(vx * vx + vy * vy);
    if (length < obj1.radius + obj2.radius) {
      return true;
    }
    return false;
  }
}
