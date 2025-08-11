import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
})

function App() {
  const [isConnected, setIsConnected] = useState(false)

  // Test backend connection
  const testConnection = async () => {
    try {
      const response = await fetch('/api/health')
      const data = await response.json()
      setIsConnected(true)
      console.log('Backend connected:', data)
    } catch (error) {
      setIsConnected(false)
      console.error('Backend connection failed:', error)
    }
  }

  // Test connection on mount
  useState(() => {
    testConnection()
  })

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-blue-600 text-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold">🏗️ MICAA</h1>
            <p className="text-blue-100 mt-2">Sistema Integral de Construcción y Arquitectura</p>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4">Estado del Sistema</h2>
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={isConnected ? 'text-green-700' : 'text-red-700'}>
                {isConnected ? 'Backend conectado y funcionando' : 'Verificando conexión...'}
              </span>
              <button 
                onClick={testConnection}
                className="ml-auto px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Probar Conexión
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-2">📋 Materiales</h3>
              <p className="text-gray-600 mb-4">Gestión completa de materiales de construcción</p>
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Acceder
              </button>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-2">🔧 Actividades</h3>
              <p className="text-gray-600 mb-4">Catálogo de actividades con análisis APU</p>
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Acceder
              </button>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-2">💰 Presupuestos</h3>
              <p className="text-gray-600 mb-4">Creación y gestión de presupuestos</p>
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Acceder
              </button>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-2">🏪 Proveedores</h3>
              <p className="text-gray-600 mb-4">Marketplace de materiales y servicios</p>
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Acceder
              </button>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-2">🌍 Factores Geográficos</h3>
              <p className="text-gray-600 mb-4">Ajustes de precios por ubicación</p>
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Acceder
              </button>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-2">📊 Dashboard</h3>
              <p className="text-gray-600 mb-4">Panel de control y estadísticas</p>
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Acceder
              </button>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-8">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">🚧 Proyecto Base Creado</h3>
            <p className="text-yellow-700">
              La estructura base de MICAA está lista. A partir de aquí puedes implementar cada módulo 
              paso a paso conectando a tu base de datos PostgreSQL existente.
            </p>
            <div className="mt-4 p-4 bg-white rounded border">
              <h4 className="font-medium mb-2">Próximos pasos:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Configurar conexión a base de datos</li>
                <li>• Implementar sistema de autenticación</li>
                <li>• Crear componentes UI de cada módulo</li>
                <li>• Agregar rutas API para cada funcionalidad</li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    </QueryClientProvider>
  )
}

export default App