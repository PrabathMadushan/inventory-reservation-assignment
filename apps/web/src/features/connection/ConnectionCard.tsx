import { useConnection } from '../../api/connection'
import { Button } from '../../components/ui/Button'
import { Feedback } from '../../components/ui/Feedback'
import { Loading } from '../../components/ui/Loading'

export function ConnectionCard() {
  const connection = useConnection()
  const loading = connection.isPending || connection.isFetching

  return (
    <section
      aria-labelledby="connection-title"
      className="card border border-base-300 bg-base-100 shadow-sm"
    >
      <div className="card-body gap-5 p-6 sm:p-8">
        <div>
          <p className="mb-2 text-xs font-medium text-base-content/75 uppercase tracking-wider">
            Application status
          </p>
          <h2 id="connection-title" className="card-title text-xl">
            Ready when you are.
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-base-content/75">
          Check your connection before continuing to products and orders.
        </p>
        {loading ? (
          <Loading label="Connecting…" />
        ) : connection.isError ? (
          <Feedback tone="error">
            Unable to connect. Check that the application is running, then try
            again.
          </Feedback>
        ) : (
          <Feedback tone="success">Application connected.</Feedback>
        )}
        <Button
          busy={connection.isFetching}
          onClick={() => {
            void connection.refetch()
          }}
          className="w-full"
        >
          {connection.isFetching ? 'Checking…' : 'Check connection again'}
        </Button>
      </div>
    </section>
  )
}
