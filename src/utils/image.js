// Shrinks a photo before upload (the server accepts up to ~500 KB per image).
// Returns a JPEG data URL no wider/taller than maxSize pixels.
export function resizeImage(file, maxSize = 1024, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file (JPG or PNG).'))
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      reject(new Error('That photo is too large (over 15 MB).'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      // JPEG has no transparency: paint white first, or transparent areas turn black.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      // Stay under the server limit (~500 KB): lower the quality if needed.
      let q = quality
      let out = canvas.toDataURL('image/jpeg', q)
      while (out.length > 600_000 && q > 0.35) {
        q -= 0.1
        out = canvas.toDataURL('image/jpeg', q)
      }
      resolve(out)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file could not be read as an image.'))
    }
    img.src = url
  })
}
