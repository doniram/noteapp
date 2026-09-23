// Dipisah dari index.html agar CSP bisa melarang script inline (script-src 'self').
try {
  document.documentElement.classList.add(localStorage.getItem('devnotes-theme') || 'dark')
} catch {
  document.documentElement.classList.add('dark')
}
