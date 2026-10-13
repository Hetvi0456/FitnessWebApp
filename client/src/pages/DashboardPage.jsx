import { useAuth } from '../context/AuthContext'
import '../styles/dashboard.css'

export default function DashboardPage() {
  const { user, logout } = useAuth()

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-logo">
          <span>🏋️</span>
          <span className="dashboard-brand">Fitness Challenge</span>
        </div>
        <div className="dashboard-user">
          <span className="dashboard-avatar">{user?.displayName?.[0]?.toUpperCase()}</span>
          <span className="dashboard-name">{user?.displayName}</span>
          <button className="logout-btn" onClick={logout}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-welcome">
          <h1>Welcome back, {user?.displayName}! 👋</h1>
          <p>Your fitness journey continues here. Challenges and features are coming soon.</p>
        </div>

        <div className="dashboard-cards">
          <div className="dash-card">
            <div className="dash-card-icon">🎯</div>
            <h2>Challenges</h2>
            <p>Join and track fitness challenges</p>
            <span className="coming-soon">Coming soon</span>
          </div>
          <div className="dash-card">
            <div className="dash-card-icon">📊</div>
            <h2>Progress</h2>
            <p>Track your fitness milestones</p>
            <span className="coming-soon">Coming soon</span>
          </div>
          <div className="dash-card">
            <div className="dash-card-icon">👥</div>
            <h2>Community</h2>
            <p>Connect with other fitness enthusiasts</p>
            <span className="coming-soon">Coming soon</span>
          </div>
        </div>
      </main>
    </div>
  )
}
