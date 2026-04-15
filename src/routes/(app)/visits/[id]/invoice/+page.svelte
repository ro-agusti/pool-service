<script lang="ts">
  import { enhance } from '$app/forms'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { visit, orgSettings, invoice, lines, total } = $derived(data)

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

      // Logo (if available)
      let headerY = 20
      if (orgSettings?.logo_url) {
        try {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = () => reject()
            img.src = orgSettings.logo_url!
          })
          const canvas = document.createElement('canvas')
          canvas.width = img.width; canvas.height = img.height
          canvas.getContext('2d')!.drawImage(img, 0, 0)
          const imgData = canvas.toDataURL('image/png')
          const logoH = 12
          const logoW = (img.width / img.height) * logoH
          doc.addImage(imgData, 'PNG', 15, 10, logoW, logoH)
          headerY = 28
        } catch { /* skip logo on error */ }
      }

      // Business name + INVOICE label
      doc.setFontSize(20)
      doc.setTextColor(15, 23, 42)
      doc.text('INVOICE', pageW - 15, 20, { align: 'right' })

      doc.setFontSize(11)
      doc.setTextColor(15, 23, 42)
      doc.text(orgSettings?.business_name ?? '', 15, headerY)

      let infoY = headerY + 6
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139)
      if (orgSettings?.abn) { doc.text(`ABN: ${orgSettings.abn}`, 15, infoY); infoY += 5 }
      if (orgSettings?.phone) { doc.text(orgSettings.phone, 15, infoY); infoY += 5 }
      if (orgSettings?.email) { doc.text(orgSettings.email, 15, infoY); infoY += 5 }
      if (orgSettings?.address) {
        const addr = [orgSettings.address, orgSettings.suburb, orgSettings.state, orgSettings.postcode].filter(Boolean).join(', ')
        doc.text(addr, 15, infoY); infoY += 5
      }

      // Invoice meta (right side)
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139)
      let metaY = 28
      if (invoice?.invoice_number) {
        doc.setFontSize(10)
        doc.setTextColor(15, 23, 42)
        doc.text(`#${invoice.invoice_number}`, pageW - 15, metaY, { align: 'right' })
        metaY += 6
        doc.setFontSize(9)
        doc.setTextColor(100, 116, 139)
      }
      doc.text(`Date: ${formatDate(visit.scheduled_date)}`, pageW - 15, metaY, { align: 'right' })
      metaY += 5
      doc.text(`Status: ${invoice?.status ?? 'pending'}`, pageW - 15, metaY, { align: 'right' })

      const dividerY = Math.max(infoY, metaY) + 5
      doc.setDrawColor(226, 232, 240)
      doc.line(15, dividerY, pageW - 15, dividerY)

      // Bill to
      let billY = dividerY + 8
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text('BILL TO', 15, billY); billY += 6
      doc.setFontSize(10)
      doc.setTextColor(15, 23, 42)
      doc.text(visit.properties?.customers?.name ?? '', 15, billY); billY += 5
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139)
      if (visit.properties?.customers?.email) { doc.text(visit.properties.customers.email, 15, billY); billY += 5 }
      if (visit.properties?.address) {
        doc.text(`${visit.properties.address}${visit.properties.suburb ? ', ' + visit.properties.suburb : ''}`, 15, billY)
        billY += 5
      }

      // Items table
      autoTable(doc, {
        startY: billY + 6,
        head: [['Description', 'Qty', 'Unit', 'Unit Price', 'Total']],
        body: lines.map(l => [l!.name, l!.qty, l!.unit, `$${l!.unit_price.toFixed(2)}`, `$${l!.total.toFixed(2)}`]),
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
      const num = invoice?.invoice_number ? `_${invoice.invoice_number}` : ''
      doc.save(`invoice${num}_${customer}_${visit.scheduled_date}.pdf`)
    } finally {
      generating = false
    }
  }

  function mailtoLink() {
    const email = visit.properties?.customers?.email ?? ''
    const subject = encodeURIComponent(`Invoice${invoice?.invoice_number ? ' #' + invoice.invoice_number : ''} — ${formatDate(visit.scheduled_date)}`)
    const body = encodeURIComponent(
      `Hi ${visit.properties?.customers?.name ?? ''},\n\nPlease find your invoice for the pool service on ${formatDate(visit.scheduled_date)}.\n\nTotal: $${total.toFixed(2)}\n\nThank you,\n${orgSettings?.business_name ?? ''}`
    )
    return `mailto:${email}?subject=${subject}&body=${body}`
  }
</script>

<div class="max-w-2xl">
  <div class="mb-6">
    <a href="/visits/{visit.id}" class="text-sm text-muted hover:text-text transition-colors">← Visit</a>
    <div class="flex items-baseline gap-3 mt-2">
      <h1 class="text-xl font-semibold text-text">Invoice</h1>
      {#if invoice?.invoice_number}
        <span class="text-sm text-muted">#{invoice.invoice_number}</span>
      {/if}
    </div>
    <p class="text-sm text-muted">{visit.properties?.customers?.name} · {formatDate(visit.scheduled_date)}</p>
  </div>

  {#if lines.length === 0}
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
      <div class="px-6 py-4 border-b border-border">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            {#if orgSettings?.logo_url}
              <img src={orgSettings.logo_url} alt="Logo" class="h-10 object-contain mb-2" />
            {/if}
            <p class="text-base font-semibold text-text">{orgSettings?.business_name ?? ''}</p>
            {#if orgSettings?.abn}<p class="text-xs text-muted">ABN: {orgSettings.abn}</p>{/if}
            {#if orgSettings?.phone}<p class="text-xs text-muted">{orgSettings.phone}</p>{/if}
            {#if orgSettings?.email}<p class="text-xs text-muted">{orgSettings.email}</p>{/if}
            {#if orgSettings?.address}
              <p class="text-xs text-muted">
                {[orgSettings.address, orgSettings.suburb, orgSettings.state, orgSettings.postcode].filter(Boolean).join(', ')}
              </p>
            {/if}
          </div>
          <div class="text-right flex-shrink-0">
            {#if invoice?.invoice_number}
              <p class="text-base font-semibold text-text">#{invoice.invoice_number}</p>
            {/if}
            <p class="text-xs text-muted mt-1">Date</p>
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
          <span class="text-xs font-medium text-muted">Description</span>
          <span class="text-xs font-medium text-muted text-right">Qty</span>
          <span class="text-xs font-medium text-muted text-right">Unit price</span>
          <span class="text-xs font-medium text-muted text-right">Total</span>
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

        {#if visit.properties?.customers?.email}
          <a href={mailtoLink()}
            class="w-full flex items-center justify-center gap-2 py-3 border border-border text-sm font-medium text-text rounded-xl hover:bg-surface transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Send by email
          </a>
        {/if}

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