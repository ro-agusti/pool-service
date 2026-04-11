<script lang="ts">
  import { enhance } from '$app/forms'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { visit, org, invoice, lines, total } = $derived(data)

  let generating = $state(false)

  function formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
  }

  async function downloadPDF() {
    generating = true
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF()
      const pageW = doc.internal.pageSize.getWidth()

      // Header
      doc.setFontSize(20)
      doc.setTextColor(15, 23, 42)
      doc.text('INVOICE', pageW - 15, 20, { align: 'right' })

      doc.setFontSize(11)
      doc.setTextColor(100, 116, 139)
      doc.text(org?.name ?? '', 15, 20)

      if (org?.email) {
        doc.setFontSize(9)
        doc.text(org.email, 15, 27)
      }

      // Invoice info
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139)
      doc.text(`Date: ${formatDate(visit.scheduled_date)}`, pageW - 15, 30, { align: 'right' })
      doc.text(`Status: ${invoice?.status ?? 'pending'}`, pageW - 15, 36, { align: 'right' })

      // Divider
      doc.setDrawColor(226, 232, 240)
      doc.line(15, 42, pageW - 15, 42)

      // Bill to
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text('BILL TO', 15, 50)
      doc.setFontSize(10)
      doc.setTextColor(15, 23, 42)
      doc.text(visit.properties?.customers?.name ?? '', 15, 57)
      if (visit.properties?.customers?.email) {
        doc.setFontSize(9)
        doc.setTextColor(100, 116, 139)
        doc.text(visit.properties.customers.email, 15, 63)
      }
      if (visit.properties?.address) {
        doc.text(`${visit.properties.address}${visit.properties.suburb ? ', ' + visit.properties.suburb : ''}`, 15, 69)
      }

      // Items table
      autoTable(doc, {
        startY: 80,
        head: [['Description', 'Qty', 'Unit', 'Unit Price', 'Total']],
        body: lines.map(l => [
          l!.name,
          l!.qty,
          l!.unit,
          `$${l!.unit_price.toFixed(2)}`,
          `$${l!.total.toFixed(2)}`
        ]),
        foot: [['', '', '', 'Total', `$${total.toFixed(2)}`]],
        headStyles: { fillColor: [14, 165, 233], textColor: 255, fontSize: 9 },
        footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold' },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { halign: 'right', cellWidth: 20 },
          2: { cellWidth: 20 },
          3: { halign: 'right', cellWidth: 25 },
          4: { halign: 'right', cellWidth: 25 }
        }
      })

      const customer = visit.properties?.customers?.name?.replace(/\s+/g, '_') ?? 'invoice'
      doc.save(`invoice_${customer}_${visit.scheduled_date}.pdf`)
    } finally {
      generating = false
    }
  }

  function mailtoLink() {
    const email = visit.properties?.customers?.email ?? ''
    const subject = encodeURIComponent(`Invoice — ${formatDate(visit.scheduled_date)}`)
    const body = encodeURIComponent(
      `Hi ${visit.properties?.customers?.name ?? ''},\n\nPlease find your invoice for the pool service on ${formatDate(visit.scheduled_date)}.\n\nTotal: $${total.toFixed(2)}\n\nThank you,\n${org?.name ?? ''}`
    )
    return `mailto:${email}?subject=${subject}&body=${body}`
  }
</script>

<div class="max-w-2xl">
  <div class="mb-6">
    <a href="/visits/{visit.id}" class="text-sm text-muted hover:text-text transition-colors">← Visit</a>
    <h1 class="text-xl font-semibold text-text mt-2">Invoice</h1>
    <p class="text-sm text-muted">{visit.properties?.customers?.name} · {formatDate(visit.scheduled_date)}</p>
  </div>

  {#if lines.length === 0}
    <!-- No checklist data -->
    <div class="bg-card border border-border rounded-xl p-8 text-center mb-6">
      <p class="text-sm font-medium text-text mb-1">No items found</p>
      <p class="text-xs text-muted">Complete the checklist first to generate an invoice with services and chemicals.</p>
      <a href="/visits/{visit.id}/checklist"
        class="inline-block mt-4 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors">
        Go to checklist
      </a>
    </div>
  {:else}
    <!-- Invoice preview -->
    <div class="bg-card border border-border rounded-xl overflow-hidden mb-4">
      <!-- Org header -->
      <div class="px-6 py-4 border-b border-border flex items-start justify-between">
        <div>
          <p class="text-base font-semibold text-text">{org?.name ?? ''}</p>
          {#if org?.email}<p class="text-xs text-muted">{org.email}</p>{/if}
        </div>
        <div class="text-right">
          <p class="text-xs text-muted">Date</p>
          <p class="text-sm font-medium text-text">{formatDate(visit.scheduled_date)}</p>
          {#if invoice}
            <span class="text-xs px-2 py-0.5 rounded-full border mt-1 inline-block capitalize
              {invoice.status === 'paid' ? 'bg-green-50 text-green-600 border-green-200' :
               invoice.status === 'overdue' ? 'bg-red-50 text-red-500 border-red-200' :
               'bg-amber-50 text-amber-600 border-amber-200'}">
              {invoice.status}
            </span>
          {/if}
        </div>
      </div>

      <!-- Bill to -->
      <div class="px-6 py-3 border-b border-border bg-surface/50">
        <p class="text-xs text-muted mb-1">Bill to</p>
        <p class="text-sm font-medium text-text">{visit.properties?.customers?.name}</p>
        {#if visit.properties?.customers?.email}
          <p class="text-xs text-muted">{visit.properties.customers.email}</p>
        {/if}
        {#if visit.properties?.address}
          <p class="text-xs text-muted">{visit.properties.address}{#if visit.properties.suburb}, {visit.properties.suburb}{/if}</p>
        {/if}
      </div>

      <!-- Line items -->
      <div class="px-6 py-3">
        <div class="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-2">
          <!-- Header -->
          <span class="text-xs font-medium text-muted">Description</span>
          <span class="text-xs font-medium text-muted text-right">Qty</span>
          <span class="text-xs font-medium text-muted text-right">Unit price</span>
          <span class="text-xs font-medium text-muted text-right">Total</span>
          <!-- Items -->
          {#each lines as line}
            <span class="text-sm text-text">{line!.name}</span>
            <span class="text-sm text-muted text-right">{line!.qty} {line!.unit}</span>
            <span class="text-sm text-muted text-right">${line!.unit_price.toFixed(2)}</span>
            <span class="text-sm font-medium text-text text-right">${line!.total.toFixed(2)}</span>
          {/each}
        </div>
      </div>

      <!-- Total -->
      <div class="px-6 py-4 border-t border-border bg-surface/50 flex items-center justify-between">
        <span class="text-sm font-medium text-text">Total</span>
        <span class="text-xl font-bold text-primary">${total.toFixed(2)}</span>
      </div>
    </div>

    <!-- Actions -->
    {#if !invoice}
      <form method="POST" action="?/create" use:enhance class="mb-3">
        <button type="submit"
          class="w-full py-3 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark transition-colors">
          Save invoice
        </button>
      </form>
    {:else}
      <div class="space-y-3">
        <!-- Download PDF -->
        <button onclick={downloadPDF} disabled={generating}
          class="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50">
          {#if generating}
            <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            Generating…
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download PDF
          {/if}
        </button>

        <!-- Send by email -->
        {#if visit.properties?.customers?.email}
          <a href={mailtoLink()}
            class="w-full flex items-center justify-center gap-2 py-3 border border-border text-sm font-medium text-text rounded-xl hover:bg-surface transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2-2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Send by email
          </a>
        {/if}

        <!-- Mark as paid -->
        {#if invoice.status === 'pending'}
          <form method="POST" action="?/markPaid" use:enhance>
            <button type="submit"
              class="w-full py-3 border border-green-200 text-green-600 bg-green-50 text-sm font-medium rounded-xl hover:bg-green-100 transition-colors">
              Mark as paid
            </button>
          </form>
        {/if}
      </div>
    {/if}
  {/if}
</div>