
# Template rule for converting wordpress article

[location]=http://localhost:8080/?page_id=455

[target]=\trunk\public\filesystem\Electronics\Opto_isolated_AVR910\Opto_isolated_AVR910.md 

Use curl. 

Download article from page [location] and save HTML into trunk/temp folder.

Download all related images and save to trunk/temp/images folder. Fix links in html.
If  there are two versions of images, preffer larger one.

Convert article to [target]

place images into /images subfolder.

Make sure links are converted as links and code is displayed as code blocks.

Try to preserve original formating.

Delete html and html images at finish.