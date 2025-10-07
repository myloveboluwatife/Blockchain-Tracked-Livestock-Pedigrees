(define-constant ERR-HASH-EXISTS u100)
(define-constant ERR-INVALID-HASH u101)
(define-constant ERR-UNAUTHORIZED u102)
(define-constant ERR-INVALID-BREED u103)
(define-constant ERR-INVALID-DATE u104)
(define-constant ERR-INACTIVE u105)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u106)
(define-constant ERR-MAX-LIVESTOCK-EXCEEDED u107)
(define-constant ERR-INVALID-DESCRIPTION u108)
(define-constant ERR-INVALID-STATUS u109)

(define-data-var livestock-counter uint u0)
(define-data-var max-livestock uint u10000)
(define-data-var authority-contract (optional principal) none)

(define-map livestock-details
  { livestock-hash: (buff 32) }
  { 
    breed: (string-ascii 50), 
    birth-date: uint, 
    description: (string-ascii 200), 
    owner: principal, 
    is-active: bool 
  }
)

(define-map livestock-by-owner
  { owner: principal }
  { livestock-hashes: (list 100 (buff 32)) }
)

(define-read-only (get-livestock (hash (buff 32)))
  (map-get? livestock-details { livestock-hash: hash })
)

(define-read-only (get-livestock-by-owner (owner principal))
  (default-to { livestock-hashes: (list ) } (map-get? livestock-by-owner { owner: owner }))
)

(define-read-only (get-livestock-count)
  (var-get livestock-counter)
)

(define-read-only (is-livestock-registered (hash (buff 32)))
  (is-some (map-get? livestock-details { livestock-hash: hash }))
)

(define-private (validate-hash (hash (buff 32)))
  (if (> (len hash) u0) (ok true) (err ERR-INVALID-HASH))
)

(define-private (validate-breed (breed (string-ascii 50)))
  (if (and (> (len breed) u0) (<= (len breed) u50)) (ok true) (err ERR-INVALID-BREED))
)

(define-private (validate-birth-date (date uint))
  (if (<= date block-height) (ok true) (err ERR-INVALID-DATE))
)

(define-private (validate-description (desc (string-ascii 200)))
  (if (<= (len desc) u200) (ok true) (err ERR-INVALID-DESCRIPTION))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78)) (ok true) (err ERR-UNAUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (register-livestock 
  (hash (buff 32)) 
  (breed (string-ascii 50)) 
  (birth-date uint) 
  (description (string-ascii 200))
)
  (let (
      (livestock-id (var-get livestock-counter))
      (current-max (var-get max-livestock))
      (authority (var-get authority-contract))
      (owner-hashes (get livestock-hashes (get-livestock-by-owner tx-sender)))
    )
    (asserts! (< livestock-id current-max) (err ERR-MAX-LIVESTOCK-EXCEEDED))
    (try! (validate-hash hash))
    (try! (validate-breed breed))
    (try! (validate-birth-date birth-date))
    (try! (validate-description description))
    (asserts! (is-none (map-get? livestock-details { livestock-hash: hash })) (err ERR-HASH-EXISTS))
    (asserts! (is-some authority) (err ERR-AUTHORITY-NOT-VERIFIED))
    (map-set livestock-details 
      { livestock-hash: hash } 
      { breed: breed, birth-date: birth-date, description: description, owner: tx-sender, is-active: true }
    )
    (map-set livestock-by-owner 
      { owner: tx-sender } 
      { livestock-hashes: (unwrap! (as-max-len? (append owner-hashes hash) u100) (err ERR-MAX-LIVESTOCK-EXCEEDED)) }
    )
    (var-set livestock-counter (+ livestock-id u1))
    (print { event: "livestock-registered", id: livestock-id, hash: hash })
    (ok livestock-id)
  )
)

(define-public (update-livestock-status (hash (buff 32)) (is-active bool))
  (let ((livestock (map-get? livestock-details { livestock-hash: hash })))
    (match livestock
      details
      (begin
        (asserts! (is-eq (get owner details) tx-sender) (err ERR-UNAUTHORIZED))
        (map-set livestock-details 
          { livestock-hash: hash } 
          { 
            breed: (get breed details), 
            birth-date: (get birth-date details), 
            description: (get description details), 
            owner: (get owner details), 
            is-active: is-active 
          }
        )
        (print { event: "status-updated", hash: hash, is-active: is-active })
        (ok true)
      )
      (err ERR-HASH-EXISTS)
    )
  )
)

(define-public (transfer-livestock (hash (buff 32)) (new-owner principal))
  (let ((livestock (map-get? livestock-details { livestock-hash: hash })))
    (match livestock
      details
      (begin
        (asserts! (is-eq (get owner details) tx-sender) (err ERR-UNAUTHORIZED))
        (asserts! (get is-active details) (err ERR-INACTIVE))
        (try! (validate-principal new-owner))
        (let (
            (old-owner-hashes (get livestock-hashes (get-livestock-by-owner tx-sender)))
            (new-owner-hashes (get livestock-hashes (get-livestock-by-owner new-owner)))
          )
          (map-set livestock-details 
            { livestock-hash: hash } 
            { 
              breed: (get breed details), 
              birth-date: (get birth-date details), 
              description: (get description details), 
              owner: new-owner, 
              is-active: (get is-active details) 
            }
          )
          (map-set livestock-by-owner 
            { owner: tx-sender } 
            { livestock-hashes: (filter (not (is-eq hash)) old-owner-hashes) }
          )
          (map-set livestock-by-owner 
            { owner: new-owner } 
            { livestock-hashes: (unwrap! (as-max-len? (append new-owner-hashes hash) u100) (err ERR-MAX-LIVESTOCK-EXCEEDED)) }
          )
          (print { event: "livestock-transferred", hash: hash, new-owner: new-owner })
          (ok true)
        )
      )
      (err ERR-HASH-EXISTS)
    )
  )
)