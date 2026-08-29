; ====================================================================
; AFSNSmartAlbum NSIS Installer Customization
; Professional License Agreement, Offline Privacy Policy & Success Alert
; ====================================================================

!macro NSIS_HOOK_PREINSTALL
  ; Display EULA, Offline Privacy Guarantee & Credits confirmation before installing
  MessageBox MB_YESNO|MB_ICONINFORMATION "AFSNSmartAlbum (v1.0.1-beta)$\r$\nProfessional Photo Album Layout Software$\r$\n$\r$\nCopyright (c) 2026 Afsunmedia - Asrofims. All rights reserved.$\r$\n$\r$\n[100% OFFLINE & PRIVACY GUARANTEE]$\r$\nAll photos, albums, and metadata remain strictly on your local computer.$\r$\nZero cloud uploads or external telemetry.$\r$\n$\r$\nDo you agree to the terms and wish to proceed with installation?" IDYES agree_license
  Abort
  agree_license:
  DetailPrint "License and privacy policy accepted by user."
  DetailPrint "Installing AFSNSmartAlbum v1.0.1-beta..."
!macroend

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Configuring desktop shortcuts and file associations..."
  DetailPrint "AFSNSmartAlbum v1.0.1-beta installation completed successfully."
  MessageBox MB_OK|MB_ICONINFORMATION "Installation Successful!$\r$\n$\r$\nAFSNSmartAlbum v1.0.1-beta is now installed on your computer.$\r$\nDesktop shortcuts and file associations (.afsn, .afsnz) are ready to use."
!macroend
