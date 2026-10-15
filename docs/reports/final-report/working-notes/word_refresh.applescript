on run argv
	set docPath to item 1 of argv
	set pdfPath to item 2 of argv
	tell application "Microsoft Word"
		activate
		open (POSIX file docPath)
		delay 3
		set d to active document
		set n to count of tables of contents of d
		repeat with i from 1 to n
			update (table of contents i of d)
		end repeat
		repeat with i from 1 to n
			update (table of contents i of d)
		end repeat
		save d
		save as d file name pdfPath file format format PDF
		close d saving no
	end tell
	return "updated " & n & " tables of contents"
end run
