import Phaser from 'phaser';
import './styles.css';
import { GameSceneIllustrated } from './game/GameSceneIllustrated';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#080d09',
  width: 1280,
  height: 720,
  scene: [GameSceneIllustrated],
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
