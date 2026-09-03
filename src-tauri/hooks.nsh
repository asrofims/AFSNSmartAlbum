; ====================================================================
; AFSNSmartAlbum NSIS Installer Customization
; Modern Professional Flow, License Policy & Success Alert
; ====================================================================

!macro NSIS_HOOK_PREINSTALL
  ; Display EULA, Offline Privacy Guarantee & Credits confirmation before installing
  MessageBox MB_YESNO|MB_ICONINFORMATION "AFSNSmartAlbum$\r$\nProfessional Photo Album Layout Software$\r$\n$\r$\nCopyright (c) 2026 Afsunmedia - Asrofims. All rights reserved.$\r$\n$\r$\n[100% OFFLINE & PRIVACY GUARANTEE]$\r$\nAll photos, albums, and metadata remain strictly on your local computer.$\r$\nZero cloud uploads or external telemetry.$\r$\n$\r$\nDo you agree to the terms and wish to proceed with installation?" IDYES agree_license
  Abort
  agree_license:
  DetailPrint "License and offline privacy policy accepted by user."
  DetailPrint "Installing AFSNSmartAlbum..."
!macroend

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Configuring desktop shortcuts and file associations..."
  DetailPrint "Registering .afsn file type..."
  DetailPrint "AFSNSmartAlbum installation completed successfully."
  MessageBox MB_OK|MB_ICONINFORMATION "Installation Successful!$\r$\n$\r$\nAFSNSmartAlbum is now installed on your computer.$\r$\n$\r$\nDesktop shortcuts and project associations (.afsn) are ready to use."
!macroend
