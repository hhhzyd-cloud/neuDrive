import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api, type BillingPlan, type BillingPlanCode, type BillingStatus, type PaidBillingPlanCode } from '../api'
import { useI18n } from '../i18n'
import { billingReasonMessage, formatBillingPrice, formatBillingStorage, resolvePlan } from './BillingShared'
import { formatDateTime } from './data/DataShared'

const PLAN_ORDER: BillingPlanCode[] = ['free', 'pro_monthly', 'pro_yearly']

function fallbackPlan(code: BillingPlanCode): BillingPlan {
  if (code === 'free') {
    return { code, name: 'Free', currency: 'usd', price_cents: 0, interval: 'month', storage_limit_bytes: 10 * 1024 * 1024 }
  }
  if (code === 'pro_yearly') {
    return { code, name: 'Pro Yearly', currency: 'usd', price_cents: 6000, interval: 'year', storage_limit_bytes: 1024 * 1024 * 1024 }
  }
  return { code, name: 'Pro Monthly', currency: 'usd', price_cents: 1000, interval: 'month', storage_limit_bytes: 1024 * 1024 * 1024 }
}

export default function BillingPage() {
  const { locale, tx } = useI18n()
  const location = useLocation()
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<PaidBillingPlanCode | 'portal' | ''>('')
  const [error, setError] = useState('')
  const reason = useMemo(() => new URLSearchParams(location.search).get('reason'), [location.search])
  const bannerMessage = useMemo(() => billingReasonMessage(reason, tx), [reason, tx])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setStatus(await api.getBillingStatus())
    } catch (err: any) {
      setError(err?.message || tx('加载 Billing 状态失败', 'Failed to load billing status'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const checkout = async (plan: PaidBillingPlanCode) => {
    if (!status?.can_checkout) return
    setBusy(plan)
    setError('')
    try {
      const response = await api.createBillingCheckout(plan)
      window.location.assign(response.checkout_url)
    } catch (err: any) {
      setError(err?.message || tx('创建支付链接失败', 'Failed to create checkout session'))
      setBusy('')
    }
  }

  const openPortal = async () => {
    if (!status?.can_manage_portal) return
    setBusy('portal')
    setError('')
    try {
      const response = await api.createBillingPortal()
      window.location.assign(response.portal_url)
    } catch (err: any) {
      setError(err?.message || tx('打开订阅管理失败', 'Failed to open billing portal'))
      setBusy('')
    }
  }

  if (loading) return <div className="page-loading">{tx('加载中...', 'Loading...')}</div>

  const current = resolvePlan(status?.plans || [], status?.current_plan || 'free')
  const usagePercent = status && status.limit_bytes > 0 ? Math.min(100, Math.round((status.used_bytes / status.limit_bytes) * 100)) : 0
  const usageLabel = status ? `${formatBillingStorage(status.used_bytes, locale)} / ${formatBillingStorage(status.limit_bytes, locale)}` : '-'
  const renewalLabel = status?.current_period_end ? formatDateTime(status.current_period_end, locale) : tx('无固定续费', 'No scheduled renewal')
  const planCards = PLAN_ORDER.map((code) => status?.plans.find((plan) => plan.code === code) || fallbackPlan(code))

  const scrollToPlans = () => {
    document.getElementById('billing-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const planFeatures = (plan: BillingPlan) => {
    switch (plan.code) {
      case 'free':
        return [
          tx('基础资料与 Memory 管理', 'Profile and memory basics'),
          tx('手动导入与手动同步', 'Manual import and sync'),
          tx('适合先验证工作流', 'Good for validating the workflow'),
        ]
      case 'pro_monthly':
        return [
          tx('自动同步与托管备份', 'Auto sync and hosted backup'),
          tx('可在 Stripe Checkout 输入兑换码', 'Promo codes in Stripe Checkout'),
          tx('按月灵活取消或调整', 'Flexible monthly billing'),
        ]
      case 'pro_yearly':
        return [
          tx('自动同步与托管备份', 'Auto sync and hosted backup'),
          tx('全年最低单月成本', 'Lowest effective monthly cost'),
          tx('优先导入与更高使用上限', 'Priority import and higher limits'),
        ]
      default:
        return []
    }
  }

  const renderPlanAction = (plan: BillingPlan) => {
    const isCurrent = status?.current_plan === plan.code
    if (isCurrent) {
      if (status?.can_manage_portal) {
        return (
          <button className="btn btn-outline btn-block" disabled={busy !== ''} onClick={() => { void openPortal() }}>
            {busy === 'portal' ? tx('打开中...', 'Opening...') : tx('管理套餐', 'Manage plan')}
          </button>
        )
      }
      return <button className="btn btn-outline btn-block" disabled>{tx('当前套餐', 'Current plan')}</button>
    }
    if (plan.code === 'free') {
      return <button className="btn btn-outline btn-block" disabled>{tx('免费套餐', 'Free plan')}</button>
    }
    if (status?.can_checkout) {
      const planCode = plan.code as PaidBillingPlanCode
      return (
        <button className={plan.code === 'pro_yearly' ? 'btn btn-primary btn-block' : 'btn btn-outline btn-block'} disabled={busy !== ''} onClick={() => { void checkout(planCode) }}>
          {busy === plan.code ? tx('跳转中...', 'Redirecting...') : plan.code === 'pro_yearly' ? tx('选择年付', 'Choose yearly') : tx('选择月付', 'Choose monthly')}
        </button>
      )
    }
    if (status?.can_manage_portal) {
      return (
        <button className="btn btn-outline btn-block" disabled={busy !== ''} onClick={() => { void openPortal() }}>
          {busy === 'portal' ? tx('打开中...', 'Opening...') : tx('在 Portal 更改', 'Change in portal')}
        </button>
      )
    }
    return <button className="btn btn-outline btn-block" disabled>{tx('暂不可用', 'Unavailable')}</button>
  }

  return (
    <div className="page billing-page-new billing-dashboard">
      {bannerMessage && <div className="alert alert-warn">{bannerMessage}</div>}
      {error && <div className="alert alert-warn">{error}</div>}

      {!status && (
        <div className="empty-action-state">
          <p>{tx('支付网关在当前部署不可用。开源核心功能仍可继续使用。', 'Billing gateway is unavailable in this deployment. Core features remain available.')}</p>
          <Link to="/onboarding" className="btn btn-primary">{tx('进入接入向导', 'Open onboarding')}</Link>
        </div>
      )}

      {status && (
        <>
          <section className="billing-current-panel">
            <div className="billing-current-head">
              <div>
                <p className="materials-kicker">{tx('当前套餐', 'Current plan')}</p>
                <h3>{current?.name || status.current_plan}</h3>
              </div>
              <div className="billing-current-actions">
                {status.can_manage_portal ? (
                  <button className="btn btn-primary" disabled={busy !== ''} onClick={() => { void openPortal() }}>
                    {busy === 'portal' ? tx('打开中...', 'Opening...') : tx('管理套餐', 'Manage plan')}
                  </button>
                ) : (
                  <button className="btn btn-primary" type="button" onClick={scrollToPlans}>{tx('管理套餐', 'Manage plan')}</button>
                )}
                <button className="btn btn-outline" disabled={busy !== '' || !status.can_checkout} onClick={() => { void checkout('pro_monthly') }}>
                  {busy === 'pro_monthly' ? tx('跳转中...', 'Redirecting...') : tx('兑换码', 'Promo code')}
                </button>
              </div>
            </div>
            <div className="billing-current-grid">
              <div className="billing-current-metric">
                <span>{tx('套餐名称', 'Plan name')}</span>
                <strong>{current?.name || status.current_plan}</strong>
              </div>
              <div className="billing-current-metric">
                <span>{tx('存储使用', 'Storage used')}</span>
                <strong>{usageLabel}</strong>
              </div>
              <div className="billing-current-metric">
                <span>{tx('续费时间', 'Renewal')}</span>
                <strong>{renewalLabel}</strong>
              </div>
            </div>
            <div className="billing-meter">
              <div className="billing-meter-fill" style={{ width: `${usagePercent}%` }} />
            </div>
          </section>

          <section className="billing-plans-section" id="billing-plans">
            <div className="billing-plan-grid">
              {planCards.map((plan) => {
                const isCurrent = plan.code === status.current_plan
                const isFeatured = plan.code === 'pro_yearly'
                return (
                  <article key={plan.code} className={`billing-plan-option ${isCurrent ? 'is-current' : ''} ${isFeatured ? 'is-featured' : ''}`}>
                    <div className="billing-plan-card-head">
                      <div>
                        <h4>{plan.name}</h4>
                        <span>{formatBillingStorage(plan.storage_limit_bytes, locale)} {tx('存储', 'storage')}</span>
                      </div>
                      {isCurrent && <span className="status-pill">{tx('当前', 'Current')}</span>}
                      {!isCurrent && isFeatured && <span className="recommended-chip">{tx('推荐', 'Recommended')}</span>}
                    </div>
                    <div className="billing-plan-price">{formatBillingPrice(plan, locale)}</div>
                    <ul className="billing-plan-features">
                      {planFeatures(plan).map((feature) => <li key={feature}>{feature}</li>)}
                    </ul>
                    <div className="billing-plan-card-action">
                      {renderPlanAction(plan)}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
