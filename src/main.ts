import Phaser from 'phaser';
import './styles.css';
import { GameScene } from './game/GameScene';
import { PresentationScene } from './game/PresentationScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#0a110d',
  width: 1280,
  height: 720,
  scene: [GameScene, PresentationScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%',
  },
  input: {
    activePointers: 2,
    touch: { capture: true },
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
};

new Phaser.Game(config);
