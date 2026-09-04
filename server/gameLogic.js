const fs = require('fs');
const path = require('path');

class GameLogic {
  // Gerar código de sala aleatório (4 letras)
  static generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Ler imagens da pasta
  static getImages() {
    const imagesDir = path.join(__dirname, '../public/images');
    const files = fs.readdirSync(imagesDir);
    return files.filter(file => 
      /\.(webp|jpg|jpeg|png|svg|gif)$/i.test(file)
    );
  }

  // Gerar tabuleiro embaralhado
  static generateBoard(images) {
    // Validar que temos 10 imagens
    if (images.length !== 10) {
      console.warn(`⚠️ Esperado 10 imagens, encontrado ${images.length}`);
    }

    // Duplicar (pares)
    const cards = [...images, ...images];
    
    // Embaralhar (Fisher-Yates)
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }

    return cards.map((image, index) => ({
      id: index,
      image: image,
      flipped: false,
      matched: false
    }));
  }
}

module.exports = GameLogic;
