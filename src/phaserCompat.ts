import Phaser from 'phaser';

declare module 'phaser' {
  namespace GameObjects {
    interface Graphics {
      fillTrapezoid(x: number, y: number, width: number, height: number, topWidth: number, bottomWidth: number): this;
    }

    interface GameObjectFactory {
      roundedRectangle(x: number, y: number, width: number, height: number, radius: number, fillColor?: number, fillAlpha?: number): Phaser.GameObjects.Rectangle;
    }

    interface Rectangle {
      sendToBack(): this;
    }
  }
}

const graphicsPrototype = Phaser.GameObjects.Graphics.prototype as Phaser.GameObjects.Graphics & {
  fillTrapezoid?: Phaser.GameObjects.Graphics['fillTrapezoid'];
};

if (!graphicsPrototype.fillTrapezoid) {
  graphicsPrototype.fillTrapezoid = function fillTrapezoid(
    this: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    topWidth: number,
    bottomWidth: number,
  ): Phaser.GameObjects.Graphics {
    const centerX = x + width / 2;
    const topHalf = topWidth / 2;
    const bottomHalf = bottomWidth / 2;
    return this.fillPoints([
      new Phaser.Geom.Point(centerX - topHalf, y),
      new Phaser.Geom.Point(centerX + topHalf, y),
      new Phaser.Geom.Point(centerX + bottomHalf, y + height),
      new Phaser.Geom.Point(centerX - bottomHalf, y + height),
    ], true);
  };
}

const factoryPrototype = Phaser.GameObjects.GameObjectFactory.prototype as Phaser.GameObjects.GameObjectFactory & {
  roundedRectangle?: Phaser.GameObjects.GameObjectFactory['roundedRectangle'];
};

if (!factoryPrototype.roundedRectangle) {
  factoryPrototype.roundedRectangle = function roundedRectangle(
    this: Phaser.GameObjects.GameObjectFactory,
    x: number,
    y: number,
    width: number,
    height: number,
    _radius: number,
    fillColor = 0xffffff,
    fillAlpha = 1,
  ): Phaser.GameObjects.Rectangle {
    return this.rectangle(x, y, width, height, fillColor, fillAlpha);
  };
}

const rectanglePrototype = Phaser.GameObjects.Rectangle.prototype as Phaser.GameObjects.Rectangle & {
  sendToBack?: () => Phaser.GameObjects.Rectangle;
};

if (!rectanglePrototype.sendToBack) {
  rectanglePrototype.sendToBack = function sendToBack(this: Phaser.GameObjects.Rectangle): Phaser.GameObjects.Rectangle {
    return this.setToBack();
  };
}
