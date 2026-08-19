export default function Modal({ onClose, children, width = 'max-w-lg' }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className={`w-full ${width} overflow-hidden rounded-xl border border-slate-700 bg-[#0d141d] shadow-2xl shadow-black/60`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}