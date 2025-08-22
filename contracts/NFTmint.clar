;; NFTMint.clar
;; Sophisticated NFT minting contract for FairTrade Artisan Marketplace
;; Implements SIP-009 NFT standard, manages minting, transfers, royalties,
;; metadata, and burning of artisan goods NFTs. Ensures authenticity and
;; fair compensation for creators.

;; Constants
(define-constant ERR-UNAUTHORIZED u200)
(define-constant ERR-INVALID-METADATA u201)
(define-constant ERR-ALREADY-MINTED u202)
(define-constant ERR-INVALID-TOKEN-ID u203)
(define-constant ERR-INVALID-ROYALTY u204)
(define-constant ERR-CONTRACT-PAUSED u205)
(define-constant ERR-NOT-OWNER u206)
(define-constant ERR-INVALID-RECIPIENT u207)
(define-constant ERR-METADATA-FROZEN u208)
(define-constant MAX-METADATA-LEN u256)
(define-constant MAX-DESCRIPTION-LEN u1000)
(define-constant MAX-ROYALTY-PERCENT u10000) ;; 100.00% in basis points
(define-constant CONTRACT-OWNER tx-sender)

;; Data Variables
(define-data-var last-token-id uint u0)
(define-data-var contract-paused bool false)
(define-data-var metadata-frozen bool false)
(define-data-var platform-fee uint u100) ;; 1% in basis points

;; Data Maps
(define-map tokens
  { token-id: uint }
  {
    owner: principal,
    metadata-uri: (string-ascii 256),
    product-hash: (buff 32), ;; SHA-256 hash of physical item
    description: (string-utf8 1000),
    origin: (string-ascii 100),
    minted-at: uint,
    royalty-recipient: principal,
    royalty-percent: uint ;; Basis points (e.g., 1000 = 10%)
  })

(define-map token-count
  { owner: principal }
  { count: uint })

(define-map mint-records
  { token-id: uint }
  {
    minter: principal,
    timestamp: uint,
    metadata-uri: (string-ascii 256)
  })

;; Private Functions
(define-private (is-valid-metadata (metadata-uri (string-ascii 256)) (description (string-utf8 1000)))
  (and
    (<= (len metadata-uri) MAX-METADATA-LEN)
    (<= (len description) MAX-DESCRIPTION-LEN)))

(define-private (increment-token-id)
  (let ((new-id (+ (var-get last-token-id) u1)))
    (var-set last-token-id new-id)
    new-id))

(define-private (update-token-count (owner principal) (delta int))
  (let ((current-count (default-to u0 (get count (map-get? token-count {owner: owner})))))
    (map-set token-count {owner: owner}
      {count: (if (> delta 0)
                  (+ current-count (to-uint delta))
                  (to-uint (- (to-int current-count) (- delta))))})))

;; Public Functions (SIP-009 Compliant)
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  (let ((token (unwrap! (map-get? tokens {token-id: token-id}) (err ERR-INVALID-TOKEN-ID))))
    (if (var-get contract-paused)
      (err ERR-CONTRACT-PAUSED)
      (if (not (is-eq (get owner token) sender))
        (err ERR-NOT-OWNER)
        (if (is-eq recipient CONTRACT-OWNER)
          (err ERR-INVALID-RECIPIENT)
          (begin
            (map-set tokens {token-id: token-id} (merge token {owner: recipient}))
            (update-token-count sender -1)
            (update-token-count recipient 1)
            (ok true)))))))

(define-public (mint
  (metadata-uri (string-ascii 256))
  (product-hash (buff 32))
  (description (string-utf8 1000))
  (origin (string-ascii 100))
  (royalty-recipient principal)
  (royalty-percent uint))
  (if (var-get contract-paused)
    (err ERR-CONTRACT-PAUSED)
    (if (not (is-valid-metadata metadata-uri description))
      (err ERR-INVALID-METADATA)
      (if (> royalty-percent MAX-ROYALTY-PERCENT)
        (err ERR-INVALID-ROYALTY)
        (if (> (len product-hash) u32)
          (err ERR-INVALID-METADATA)
          (let ((new-token-id (increment-token-id)))
            (if (is-some (map-get? tokens {token-id: new-token-id}))
              (err ERR-ALREADY-MINTED)
              (begin
                (map-set tokens {token-id: new-token-id}
                  {
                    owner: tx-sender,
                    metadata-uri: metadata-uri,
                    product-hash: product-hash,
                    description: description,
                    origin: origin,
                    minted-at: block-height,
                    royalty-recipient: royalty-recipient,
                    royalty-percent: royalty-percent
                  })
                (map-set mint-records {token-id: new-token-id}
                  {
                    minter: tx-sender,
                    timestamp: block-height,
                    metadata-uri: metadata-uri
                  })
                (update-token-count tx-sender 1)
                (ok new-token-id)))))))))

(define-public (burn (token-id uint))
  (let ((token (unwrap! (map-get? tokens {token-id: token-id}) (err ERR-INVALID-TOKEN-ID))))
    (if (var-get contract-paused)
      (err ERR-CONTRACT-PAUSED)
      (if (not (is-eq (get owner token) tx-sender))
        (err ERR-NOT-OWNER)
        (begin
          (map-delete tokens {token-id: token-id})
          (map-delete mint-records {token-id: token-id})
          (update-token-count tx-sender -1)
          (ok true))))))

(define-public (update-metadata (token-id uint) (metadata-uri (string-ascii 256)) (description (string-utf8 1000)))
  (let ((token (unwrap! (map-get? tokens {token-id: token-id}) (err ERR-INVALID-TOKEN-ID))))
    (if (var-get contract-paused)
      (err ERR-CONTRACT-PAUSED)
      (if (var-get metadata-frozen)
        (err ERR-METADATA-FROZEN)
        (if (not (is-eq (get owner token) tx-sender))
          (err ERR-NOT-OWNER)
          (if (not (is-valid-metadata metadata-uri description))
            (err ERR-INVALID-METADATA)
            (begin
              (map-set tokens {token-id: token-id}
                (merge token {metadata-uri: metadata-uri, description: description}))
              (ok true))))))))

(define-public (set-contract-paused (paused bool))
  (if (is-eq tx-sender CONTRACT-OWNER)
    (begin
      (var-set contract-paused paused)
      (ok true))
    (err ERR-UNAUTHORIZED)))

(define-public (set-metadata-frozen (frozen bool))
  (if (is-eq tx-sender CONTRACT-OWNER)
    (begin
      (var-set metadata-frozen frozen)
      (ok true))
    (err ERR-UNAUTHORIZED)))

(define-public (set-platform-fee (fee uint))
  (if (is-eq tx-sender CONTRACT-OWNER)
    (if (> fee MAX-ROYALTY-PERCENT)
      (err ERR-INVALID-ROYALTY)
      (begin
        (var-set platform-fee fee)
        (ok true)))
    (err ERR-UNAUTHORIZED)))

;; Read-Only Functions
(define-read-only (get-last-token-id)
  (ok (var-get last-token-id)))

(define-read-only (get-token-uri (token-id uint))
  (match (map-get? tokens {token-id: token-id})
    token (ok (get metadata-uri token))
    (err ERR-INVALID-TOKEN-ID)))

(define-read-only (get-owner (token-id uint))
  (match (map-get? tokens {token-id: token-id})
    token (ok (some (get owner token)))
    (err ERR-INVALID-TOKEN-ID)))

(define-read-only (get-token-details (token-id uint))
  (map-get? tokens {token-id: token-id}))

(define-read-only (get-mint-record (token-id uint))
  (map-get? mint-records {token-id: token-id}))

(define-read-only (get-token-count (owner principal))
  (ok (default-to u0 (get count (map-get? token-count {owner: owner})))))

(define-read-only (get-platform-fee)
  (ok (var-get platform-fee)))

(define-read-only (is-contract-paused)
  (ok (var-get contract-paused)))

(define-read-only (is-metadata-frozen)
  (ok (var-get metadata-frozen)))