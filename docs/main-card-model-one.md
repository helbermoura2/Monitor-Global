# Main event card: model 1

The earthquake front presents the existing magnitude gauge, location/flag, occurrence time and the two primary measurements (depth and intensity). Intensity still uses the existing source/estimate labels; this layout supplies no measurements or tsunami conclusions.

Related official tsunami bulletins sit after the measurements. The footer contains source evidence chips and the existing image/detail buttons. Energy, estimated impact, revision timeline, distance and individual agency magnitudes remain available in Details.

`MainCardLayout` moves the original live DOM nodes, retaining their IDs and handlers; it restores their original positions for other event types and capital weather. The compact mobile summary keeps the location and the detail button available. No requests, timers or Worker/DO calls are added.

Offline browser coverage: desktop and mobile detail opening/closing, repeated refreshes, restoration of the previous structure, and transient earthquake-record expiry regression.
