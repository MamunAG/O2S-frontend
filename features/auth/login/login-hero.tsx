export function LoginHero() {
  return (
    <section className="flex flex-col justify-center gap-6">
      <div className="inline-flex w-fit items-center rounded-full border border-slate-200/70 bg-white/70 px-4 py-1 text-xs font-medium tracking-wide text-slate-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        Code Crafter X
      </div>
      <div className="space-y-4">
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Sign in to continue building the workspace.
        </h1>
        <p className="max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
          Sign in with your email and password to open your workspace.
        </p>
      </div>
    </section>
  )
}
