type ToastType = 'error' | 'success' | 'info'

export function toast(message: string, type: ToastType = 'error') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('mb:toast', { detail: { message, type } }))
}

toast.error   = (msg: string) => toast(msg, 'error')
toast.success = (msg: string) => toast(msg, 'success')
toast.info    = (msg: string) => toast(msg, 'info')
