describe('Yaju-Tube smoke flow', () => {
  it('loads saved PeerTube instances and opens the video list without a live network dependency', () => {
    cy.intercept('GET', 'https://e2e.example/api/v1/videos*', {
      statusCode: 200,
      body: {
        total: 0,
        data: [],
      },
    }).as('videos')

    cy.visit('/tabs/tab1', {
      onBeforeLoad(win) {
        win.localStorage.setItem('locale', 'ja')
        win.localStorage.setItem(
          'instances',
          JSON.stringify([{ name: 'E2E Instance', url: 'e2e.example' }]),
        )
      },
    })

    cy.contains('ion-title', 'インスタンス一覧').should('be.visible')
    cy.contains('ion-item', 'E2E Instance').click()

    cy.location('pathname').should('eq', '/tabs/tab2')
    cy.wait('@videos').its('request.query').should('deep.include', {
      sort: '-publishedAt',
      start: '0',
      count: '20',
    })
    cy.contains('ion-title', '動画一覧').should('be.visible')
    cy.contains('取得できる動画はありません。').should('be.visible')
  })
})
