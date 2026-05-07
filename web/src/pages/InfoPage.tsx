import { useEffect, useState } from 'react'
import { api, type FileNode, type MemoryConflict } from '../api'
import { useI18n } from '../i18n'

const profileFields = [
  { key: 'preferences', label: { zh: '工作偏好', en: 'Work preferences' } },
  { key: 'writing_style', label: { zh: '写作风格', en: 'Writing style' } },
  { key: 'communication', label: { zh: '沟通偏好', en: 'Communication preferences' } },
  { key: 'principles', label: { zh: '决策风格', en: 'Decision style' } },
]

const commonLanguages = [
  { value: 'zh-CN', label: '中文（简体）' },
  { value: 'zh-TW', label: '中文（繁體）' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'it', label: 'Italiano' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'ru', label: 'Русский' },
  { value: 'ar', label: 'العربية' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'th', label: 'ไทย' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'pl', label: 'Polski' },
]

export default function InfoPage() {
  const { locale, tx } = useI18n()
  const [values, setValues] = useState<Record<string, string>>({})
  const [userProfile, setUserProfile] = useState<Record<string, any>>({})
  const [entries, setEntries] = useState<FileNode[]>([])
  const [conflicts, setConflicts] = useState<MemoryConflict[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    const [meResult, profileResult, snapshotResult, conflictsResult] = await Promise.allSettled([
      api.getMe(),
      api.getProfile(),
      api.getTreeSnapshot('/'),
      api.getConflicts(),
    ])
    const me = meResult.status === 'fulfilled' ? meResult.value || {} : {}
    if (meResult.status === 'fulfilled') setUserProfile(me)
    if (profileResult.status === 'fulfilled') {
      const next = profileResult.value || {}
      const prefs = next.preferences || {}
      setValues({
        display_name: String(me.display_name || next.display_name || prefs.display_name || ''),
        language: String(me.language || locale),
        preferences: String(prefs.preferences || ''),
        writing_style: String(prefs.writing_style || ''),
        communication: String(prefs.communication || ''),
        principles: String(prefs.principles || ''),
      })
    }
    if (snapshotResult.status === 'fulfilled') setEntries(snapshotResult.value.entries)
    if (conflictsResult.status === 'fulfilled') setConflicts(conflictsResult.value || [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const saveProfile = async () => {
    setSaving('profile')
    setError('')
    try {
      await Promise.all([
        api.updateMe({
          display_name: values.display_name || '',
          bio: String(userProfile.bio || ''),
          timezone: String(userProfile.timezone || 'UTC'),
          language: values.language || locale,
        }),
        api.upsertProfile({
          preferences: {
            preferences: values.preferences || '',
            writing_style: values.writing_style || '',
            communication: values.communication || '',
            principles: values.principles || '',
          },
        }),
      ])
      setMessage(tx('Profile 已保存。', 'Profile saved.'))
      await load()
    } catch (err: any) {
      setError(err?.message || tx('保存失败', 'Save failed'))
    } finally {
      setSaving('')
    }
  }

  const resolveConflict = async (id: string, resolution: string) => {
    try {
      await api.resolveConflict(id, resolution)
      setConflicts((current) => current.filter((item) => item.id !== id))
      setMessage(tx('冲突已解决。', 'Conflict resolved.'))
    } catch (err: any) {
      setError(err?.message || tx('解决冲突失败', 'Failed to resolve conflict'))
    }
  }

  const exportAll = async () => {
    await api.exportZip()
    setMessage(tx('导出已开始。', 'Export started.'))
  }

  const deleteImportedConversations = async () => {
    if (!window.confirm(tx('删除所有导入会话？此操作不可撤销。', 'Delete all imported conversations? This cannot be undone.'))) return
    const conversations = entries.filter((entry) => entry.path.startsWith('/conversations/') && (entry.is_dir || entry.name.endsWith('.md')))
    for (const entry of conversations) {
      await api.deleteTree(entry.path)
    }
    setMessage(tx('导入会话已删除。', 'Imported conversations deleted.'))
    await load()
  }

  const clearMemory = async () => {
    if (!window.confirm(tx('清空 Memory？Profile 之外的记忆会被删除。', 'Clear memory? Memory outside Profile will be deleted.'))) return
    const memory = entries.filter((entry) => entry.path.startsWith('/memory/') && !entry.path.startsWith('/memory/profile/'))
    for (const entry of memory) {
      await api.deleteTree(entry.path)
    }
    setMessage(tx('Memory 已清空。', 'Memory cleared.'))
    await load()
  }

  const revokeAllTokens = async () => {
    if (!window.confirm(tx('撤销所有 token？所有外部 Agent 将失去访问权限。', 'Revoke all tokens? External agents will lose access.'))) return
    const tokens = await api.getTokens()
    for (const token of tokens) {
      if (!token.is_revoked) await api.revokeToken(token.id)
    }
    setMessage(tx('Token 已全部撤销。', 'All tokens revoked.'))
  }

  if (loading) return <div className="page-loading">{tx('加载中...', 'Loading...')}</div>

  return (
    <div className="page profile-page">
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-warn">{error}</div>}

      <section className="card profile-main-card">
        <div className="card-header">
          <h3 className="card-title">{tx('neuDrive 了解你的信息', 'What neuDrive knows about you')}</h3>
          <button className="btn btn-primary" disabled={saving !== ''} onClick={() => { void saveProfile() }}>{saving ? tx('保存中...', 'Saving...') : tx('保存', 'Save Profile')}</button>
        </div>
        <div className="profile-field-grid">
          <label className="profile-edit-field">
            <span>{tx('名称', 'Name')}</span>
            <input className="input" value={values.display_name || ''} onChange={(event) => setValues({ ...values, display_name: event.target.value })} />
          </label>
          <label className="profile-edit-field">
            <span>{tx('语言偏好', 'Language preference')}</span>
            <select value={values.language || locale} onChange={(event) => setValues({ ...values, language: event.target.value })}>
              {commonLanguages.map((language) => (
                <option key={language.value} value={language.value}>{language.label}</option>
              ))}
            </select>
          </label>
          {profileFields.map((field) => (
            <label key={field.key} className="profile-edit-field profile-long-field">
              <span>{tx(field.label.zh, field.label.en)}</span>
              <textarea value={values[field.key] || ''} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} />
            </label>
          ))}
        </div>
      </section>

      {conflicts.length > 0 && (
        <section className="card">
          <div className="card-header">
            <h3 className="card-title">{tx('记忆冲突', 'Memory conflicts')}</h3>
          </div>
          <div className="conflict-list">
            {conflicts.map((conflict) => (
              <div key={conflict.id} className="conflict-card">
                <strong>{conflict.category}</strong>
                <div className="conflict-options">
                  <div><span>{conflict.source_a}</span><p>{conflict.content_a}</p><button className="btn btn-outline" onClick={() => { void resolveConflict(conflict.id, 'keep_a') }}>{tx('保留', 'Keep')}</button></div>
                  <div><span>{conflict.source_b}</span><p>{conflict.content_b}</p><button className="btn btn-outline" onClick={() => { void resolveConflict(conflict.id, 'keep_b') }}>{tx('保留', 'Keep')}</button></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card privacy-actions">
        <div className="card-header">
          <h3 className="card-title">{tx('隐私操作', 'Privacy Actions')}</h3>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={() => { void exportAll() }}>{tx('导出全部数据', 'Export all data')}</button>
          <button className="btn btn-outline" onClick={() => { void deleteImportedConversations() }}>{tx('删除导入会话', 'Delete imported conversations')}</button>
          <button className="btn btn-outline" onClick={() => { void clearMemory() }}>{tx('清空记忆', 'Clear memory')}</button>
          <button className="btn btn-danger" onClick={() => { void revokeAllTokens() }}>{tx('撤销全部 token', 'Revoke all tokens')}</button>
        </div>
      </section>
    </div>
  )
}
