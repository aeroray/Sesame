; Notify Explorer after replacing the EXE or changing file associations.
; SHCNE_ASSOCCHANGED | SHCNF_IDLIST (0) + SHCNF_FLUSH refreshes cached icons.
!include "${__FILEDIR__}\..\gen\file-associations.nsh"

; Tauri's generic macros replace extension defaults and reuse names such as
; "Image File". Our generated, application-owned ProgIds provide candidates.
; Do not overwrite defaults or delete classes owned by other applications.
!macroundef APP_ASSOCIATE
!macro APP_ASSOCIATE EXT FILECLASS DESCRIPTION ICON COMMANDTEXT COMMAND
!macroend
!macroundef APP_UNASSOCIATE
!macro APP_UNASSOCIATE EXT FILECLASS
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro SESAME_REGISTER_FILE_CANDIDATES
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0x1000, p 0, p 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  !insertmacro SESAME_UNREGISTER_FILE_CANDIDATES
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0x1000, p 0, p 0)'
!macroend
