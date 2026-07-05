export default function PageLoader() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F8FAFC',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}>
        <div style={{
          width: 36,
          height: 36,
          border: '3px solid #E2E8F0',
          borderTopColor: '#2563EB',
          borderRadius: '50%',
          animation: 'spin 0.75s linear infinite',
        }} />
        <p style={{ fontSize: 14, color: '#94A3B8', fontFamily: 'Arial, sans-serif' }}>Loading…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
