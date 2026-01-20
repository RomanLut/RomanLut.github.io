# Filesystem 

Virtual filesystem is defined in /public/filesystem/filesystem.json

The structure is a graph of items,

{
 "items": 
 [
   {
     "type": "folder",
     "name": "CNC",
	   "path:" : "CNC"

     items: []
   }
 ]
}

Eaach item, can have the following properties:

type: folder, wordpad
name: displayed name
path: path inside /filesystem folder
image?: optional folder image name, without path (f.e. folder_image.jpg)
desc?: optional descriptopn text of the folder

The /public/filesystem/filesystem.json is build automatically with script tools/update_filesystem.py

Script scans public/filesysem directory.
If folder_image.jpg  is present, it is adde to item.
If folder.md  is present, its conents are added as "desc".

name of the item/folder is generated from the name of file on filesystem. 

Empty folders are removed from the structure.