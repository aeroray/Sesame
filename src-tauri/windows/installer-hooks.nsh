; Notify Explorer after replacing the EXE or changing file associations.
; SHCNE_ASSOCCHANGED | SHCNF_IDLIST (0) + SHCNF_FLUSH refreshes cached icons.
!include "${__FILEDIR__}\..\gen\file-associations.nsh"

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro SESAME_REGISTER_FILE_CANDIDATES
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0x1000, p 0, p 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  !insertmacro SESAME_UNREGISTER_FILE_CANDIDATES
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0x1000, p 0, p 0)'
!macroend
