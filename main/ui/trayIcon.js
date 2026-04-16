const path = require('path');
const { Tray, Menu, nativeImage } = require('electron');

function fallbackTrayIcon() {
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAUVBMVEUAAAD///////////////////////////////////////////////////////////////////////////////////////////////////////8IN1qMAAAAHHRSTlMAb+fJjj0Q/X5kRLWlk4A3Jx6UD9jEwoVXSPM9ACgaBI9nAAAAWUlEQVQY002PSQ7AIAwD8w+YJibJ//9rZ4EqJ0jNjaQ11ERhHZWRFVcF8p15yhxq7O8iwUjJ1Ah5R9LqJdl8g6a8ZDo3gmdfA2xAHh6vYB2A9xPf1zN4P8AzfAKxvQ4vS8E4eS8fWlEAAAAASUVORK5CYII='
  );
}

function resolveTrayIcon() {
  const possible = [
    path.join(process.cwd(), 'src', 'assets', 'tray.png'),
    path.join(__dirname, '..', '..', 'src', 'assets', 'tray.png')
  ];

  for (const iconPath of possible) {
    const icon = nativeImage.createFromPath(iconPath);

    if (!icon.isEmpty()) {
      return icon;
    }
  }

  return fallbackTrayIcon();
}

function createTrayIcon({ onShow, onQuit }) {
  const tray = new Tray(resolveTrayIcon());
  tray.setToolTip('My Dashboard');

  const buildMenu = () => Menu.buildFromTemplate([
    {
      label: 'Abrir My Dashboard',
      click: () => onShow?.()
    },
    {
      type: 'separator'
    },
    {
      label: 'Salir',
      click: () => {
        onQuit?.();
      }
    }
  ]);

  tray.setContextMenu(buildMenu());

  tray.on('double-click', () => {
    onShow?.();
  });

  return tray;
}

module.exports = {
  createTrayIcon
};
