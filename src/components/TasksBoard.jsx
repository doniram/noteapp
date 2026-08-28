import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  ListTodo,
  Loader2,
} from 'lucide-react'
import { api } from '../api'
import { useApp } from '../context/useApp'
import Modal from './Modal'

const SWATCHES = ['#8b5cf6', '#f59e0b', '#38bdf8', '#10b981', '#ec4899', '#64748b']

function ColorPicker({ value, onChange }) {
  const { t } = useApp()
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`h-6 w-6 rounded-full transition-transform ${
              value === c ? 'scale-110 ring-2 ring-white/70' : 'hover:scale-105'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span
          className="h-6 w-6 shrink-0 rounded-full border border-slate-600"
          style={{ backgroundColor: value || 'transparent' }}
        />
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#8b5cf6"
          className="w-28 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[12px] text-slate-100 placeholder:text-slate-600 focus:border-sky-700 focus:outline-none"
        />
        <span className="text-[11px] text-slate-600">{t('tasks.hexHint')}</span>
      </div>
    </div>
  )
}

function computeMove(list, dragId, targetStatusId, beforeTaskId) {
  const next = list.map((t) => ({ ...t }))
  const moving = next.find((t) => t.id === dragId)
  if (!moving) return next
  if (moving.statusId === targetStatusId && beforeTaskId === dragId) return next

  const sourceStatus = moving.statusId
  const others = next.filter((t) => t.id !== dragId)
  const col = (sid) => others.filter((t) => t.statusId === sid).sort((a, b) => a.position - b.position)

  const target = col(targetStatusId)
  let idx = beforeTaskId ? target.findIndex((t) => t.id === beforeTaskId) : target.length
  if (idx === -1) idx = target.length
  moving.statusId = targetStatusId
  target.splice(idx, 0, moving)

  const affected = new Set([sourceStatus, targetStatusId])
  const positions = {}
  for (const sid of affected) {
    const arr = sid === targetStatusId ? target : col(sid)
    positions[sid] = arr.map((t) => t.id)
  }
  for (const t of next) {
    const order = positions[t.statusId]
    if (!order) continue
    const pos = order.indexOf(t.id)
    if (pos !== -1) t.position = pos
  }
  return next
}

export default function TasksBoard() {
  const { t } = useApp()
  const [columns, setColumns] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [newColOpen, setNewColOpen] = useState(false)
  const [newColName, setNewColName] = useState('')
  const [newColColor, setNewColColor] = useState(SWATCHES[0])
  const [addingIn, setAddingIn] = useState(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const [editCol, setEditCol] = useState(null)
  const [editColName, setEditColName] = useState('')
  const [editColColor, setEditColColor] = useState('')

  const [editingTask, setEditingTask] = useState(null)
  const [editTitle, setEditTitle] = useState('')

  const [dragOverCol, setDragOverCol] = useState(null)
  const dragIdRef = useRef(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const board = await api.getTasksBoard()
        if (!mounted) return
        setColumns(board.columns)
        setTasks(board.tasks)
      } catch (e) {
        if (mounted) setError(e.message)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const sortedCols = useMemo(
    () => [...columns].sort((a, b) => a.position - b.position),
    [columns]
  )
  const byColumn = useMemo(() => {
    const m = {}
    for (const c of columns) m[c.id] = []
    const sorted = [...tasks].sort((a, b) => a.position - b.position)
    for (const t of sorted) {
      if (!m[t.statusId]) m[t.statusId] = []
      m[t.statusId].push(t)
    }
    return m
  }, [columns, tasks])

  const handleDrop = (targetStatusId, beforeTaskId, dragId) => {
    setDragOverCol(null)
    if (!dragId) return
    const next = computeMove(tasks, dragId, targetStatusId, beforeTaskId)
    setTasks(next)
    api
      .reorderTasks(next.map((t) => ({ id: t.id, statusId: t.statusId, position: t.position })))
      .catch((e) => setError(e.message))
  }

  const onDragStart = (e, taskId) => {
    dragIdRef.current = taskId
    e.dataTransfer.setData('text/plain', taskId)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragEnd = () => {
    dragIdRef.current = null
    setDragOverCol(null)
  }

  const addColumn = async () => {
    const name = newColName.trim()
    if (!name) return
    try {
      const created = await api.createTaskStatus({ name, color: newColColor })
      setColumns((prev) => [...prev, created])
      setNewColColor(SWATCHES[0])
      setNewColName('')
      setNewColOpen(false)
    } catch (e) {
      setError(e.message)
    }
  }

  const openEditColumn = (col) => {
    setEditCol(col)
    setEditColName(col.name)
    setEditColColor(col.color)
  }

  const saveColumn = async () => {
    if (!editCol) return
    const name = editColName.trim()
    if (!name) return
    try {
      const updated = await api.updateTaskStatus(editCol.id, { name, color: editColColor })
      setColumns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setEditCol(null)
    } catch (e) {
      setError(e.message)
    }
  }

  const deleteColumn = async (col) => {
    if (!window.confirm(t('tasks.deleteColumnConfirm', { name: col.name }))) return
    try {
      await api.deleteTaskStatus(col.id)
      setColumns((prev) => prev.filter((c) => c.id !== col.id))
      setTasks((prev) => prev.filter((t) => t.statusId !== col.id))
    } catch (e) {
      setError(e.message)
    }
  }

  const moveColumn = async (colId, dir) => {
    const idx = sortedCols.findIndex((c) => c.id === colId)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= sortedCols.length) return
    const arr = [...sortedCols]
    ;[arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]]
    setColumns(arr.map((c, i) => ({ ...c, position: i })))
    try {
      await api.reorderTaskStatuses(arr.map((c) => c.id))
    } catch (e) {
      setError(e.message)
    }
  }

  const addTask = async (statusId) => {
    const title = newTaskTitle.trim()
    if (!title) {
      setAddingIn(null)
      setNewTaskTitle('')
      return
    }
    try {
      const created = await api.createTask({ title, statusId })
      setTasks((prev) => [...prev, created])
      setAddingIn(null)
      setNewTaskTitle('')
    } catch (e) {
      setError(e.message)
    }
  }

  const saveTaskTitle = async () => {
    if (!editingTask) return
    const title = editTitle.trim()
    try {
      const updated = await api.updateTask(editingTask.id, { title: title || editingTask.title })
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch (e) {
      setError(e.message)
    } finally {
      setEditingTask(null)
    }
  }

  const deleteTask = async (id) => {
    try {
      await api.deleteTask(id)
      setTasks((prev) => prev.filter((t) => t.id !== id))
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-[#0b111a]">
      <div className="flex items-center gap-3 border-b border-slate-800/70 px-5 py-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15">
          <ListTodo className="h-4 w-4 text-sky-300" />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-slate-100">{t('tasks.title')}</h2>
          <p className="text-[12px] text-slate-500">
            {t('tasks.summary', { tasks: tasks.length, cols: sortedCols.length })}
          </p>
        </div>
        {error && (
          <span className="ml-auto max-w-[40%] truncate text-[12px] text-rose-400">{error}</span>
        )}
      </div>

      <div className="flex flex-1 items-start gap-3 overflow-x-auto overflow-y-hidden p-4">
        {sortedCols.map((col, idx) => {
          const list = byColumn[col.id] || []
          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(e) => {
                e.preventDefault()
                handleDrop(col.id, null, e.dataTransfer.getData('text/plain'))
              }}
              onDragEnter={() => setDragOverCol(col.id)}
              onDragLeave={() => setDragOverCol((c) => (c === col.id ? null : c))}
              className={`flex max-h-full w-64 shrink-0 flex-col rounded-xl border bg-[#0d141d] transition-shadow ${
                dragOverCol === col.id
                  ? 'border-sky-600/70 shadow-lg shadow-sky-950/40'
                  : 'border-slate-800/70'
              }`}
            >
              <div className="h-1 w-full" style={{ backgroundColor: col.color }} />
              <div className="group flex items-center gap-2 border-b border-slate-800/70 px-3 py-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: col.color }} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-200">
                  {col.name}
                </span>
                <span
                  className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                  style={{ color: col.color, backgroundColor: col.color + '1f' }}
                >
                  {list.length}
                </span>
                <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => moveColumn(col.id, -1)}
                    disabled={idx === 0}
                    title={t('tasks.moveLeft')}
                    className="rounded p-0.5 text-slate-500 hover:bg-white/10 hover:text-sky-300 disabled:opacity-30"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => moveColumn(col.id, 1)}
                    disabled={idx === sortedCols.length - 1}
                    title={t('tasks.moveRight')}
                    className="rounded p-0.5 text-slate-500 hover:bg-white/10 hover:text-sky-300 disabled:opacity-30"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => openEditColumn(col)}
                    title={t('tasks.editColumn')}
                    className="rounded p-0.5 text-slate-500 hover:bg-white/10 hover:text-sky-300"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => deleteColumn(col)}
                    title={t('common.delete')}
                    className="rounded p-0.5 text-slate-500 hover:bg-rose-500/15 hover:text-rose-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
                {list.map((task) => {
                  const editing = editingTask?.id === task.id
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, task.id)}
                      onDragEnd={onDragEnd}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const dragId = e.dataTransfer.getData('text/plain')
                        if (dragId !== task.id) handleDrop(col.id, task.id, dragId)
                      }}
                      className="group border border-slate-800/70 bg-[#0f171f] px-3 py-2 text-[13px] text-slate-200 transition-colors hover:border-slate-600 hover:bg-[#101a24]"
                    >
                      {editing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveTaskTitle()
                              if (e.key === 'Escape') setEditingTask(null)
                            }}
                            className="w-full rounded border border-sky-700 bg-slate-900 px-1.5 py-1 text-[13px] text-slate-100 focus:outline-none"
                          />
                          <button
                            onClick={saveTaskTitle}
                            className="rounded p-0.5 text-sky-300 hover:text-sky-200"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            onDoubleClick={() => {
                              setEditingTask(task)
                              setEditTitle(task.title)
                            }}
                            className="flex-1 truncate text-left text-slate-200"
                            title={t('editor.dblclickTitle')}
                          >
                            {task.title}
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            title={t('common.delete')}
                            className="rounded p-0.5 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500/15 hover:text-rose-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
                {addingIn === col.id && (
                  <div className="border border-slate-700 bg-[#0f171f] px-3 py-2">
                    <input
                      autoFocus
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addTask(col.id)
                        if (e.key === 'Escape') {
                          setAddingIn(null)
                          setNewTaskTitle('')
                        }
                      }}
                      placeholder={t('tasks.taskTitle')}
                      className="w-full bg-transparent text-[13px] text-slate-200 placeholder:text-slate-600 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setAddingIn(addingIn === col.id ? null : col.id)
                  setNewTaskTitle('')
                }}
                className="flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium text-slate-500 transition-colors hover:text-sky-300"
              >
                {addingIn === col.id ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {addingIn === col.id ? t('tasks.cancel') : t('tasks.newPage')}
              </button>
            </div>
          )
        })}

        <div className="w-52 shrink-0">
          {newColOpen ? (
            <div className="rounded-xl border border-slate-700 bg-[#0d141d] p-2.5">
              <input
                autoFocus
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addColumn()
                  if (e.key === 'Escape') {
                    setNewColOpen(false)
                    setNewColName('')
                    setNewColColor(SWATCHES[0])
                  }
                }}
                placeholder={t('tasks.columnName')}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[13px] text-slate-100 placeholder:text-slate-600 focus:border-sky-700 focus:outline-none"
              />
              <ColorPicker value={newColColor} onChange={setNewColColor} />
              <button
                onClick={addColumn}
                className="mt-2 w-full rounded-lg bg-sky-600 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-sky-500"
              >
                {t('tasks.addColumn')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setNewColOpen(true)}
              className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-slate-800 px-3 py-3 text-[13px] text-slate-500 transition-colors hover:border-sky-800 hover:bg-sky-500/5 hover:text-sky-300"
            >
              <Plus className="h-4 w-4" />
              {t('tasks.newColumn')}
            </button>
          )}
        </div>
      </div>

      {editCol && (
        <Modal onClose={() => setEditCol(null)} width="max-w-sm">
          <div className="p-5">
            <h3 className="text-[15px] font-semibold text-slate-100">{t('tasks.editColumn')}</h3>
            <label className="mt-4 block text-[12px] font-medium text-slate-500">{t('tasks.columnName').replace('...', '')}</label>
            <input
              autoFocus
              value={editColName}
              onChange={(e) => setEditColName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveColumn()}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-[13px] text-slate-100 focus:border-sky-700 focus:outline-none"
            />
            <label className="mt-4 block text-[12px] font-medium text-slate-500">{t('tasks.color')}</label>
            <ColorPicker value={editColColor} onChange={setEditColColor} />
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setEditCol(null)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-[12px] text-slate-400 hover:bg-white/5"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={saveColumn}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-sky-500"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
