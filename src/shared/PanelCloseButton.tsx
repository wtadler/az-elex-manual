/** The ✕ Close button in a side panel's toolbar. `label` names the panel for screen readers. */
export function PanelCloseButton({ onClose, label }: { onClose: () => void; label: string }) {
  return (
    <button type="button" className="panel-close" onClick={onClose} aria-label={label}>
      ✕<span className="panel-close-label"> Close</span>
    </button>
  )
}
