
1: No more than 3 workflows are visible at a time. 
Solution: Each new workflow should stack vertically after 3, ie. in each row as currently, there is room for 3 workflows, after having added the 3 workflows new workflows should be added below also in rows of 3, there should be no limitation on this. 

2: Currently the text for the delete workflow button text is the same colour as the background for the button, this is specifically for the button you press AFTER having written the name of the workflow ie. to confirm the final delete

3: IMPORTANT: Workflows still dont actually work, ie. nothing happens when i press a workflow button.
How it should work: 
After pressing the workflow button the all files uploaded to workflow as well as the master prompt should be trigger a new conversation. Ie. it should work by 1. treating the master prompt as the input to the chatbox and 2. and uploading any files stored in the workflow to the chatbox. 3. It should then trigger the actual conversation such that suna / node begins to run. 



Note to self: i will write in the master prompt that node/suna should prompt the user to upload the specific memo or other files before proceding. ie. the approach will be 1. press workflow button 2. node/suna loads in the neccessary context to run the workflow but does not procede with actually performing the workflow, instead asks the user to upload the documents and information that the workflow is going to analyse / execute based on. 3. The user uploads the neccessary docs and then suna / node, uses the uploaded docs and the entire context provided by the workflow to produce the results. The prompt for making suna / node ask the user will be provided in the master prompt. 

4: Creating new workflows still does not work when having uploaded a file. The uploaded files dont show up again when inspecting the workflow. 


5: Dashboard:
    Add a way to organize conversations. 
    1. Create a design doc describing how currently conversations are stored. 
        Create seperate sections for how conversations are implemented in the UI part (frontend) and how its stored in the database / backend.
        Make sure to gain a proper overview of relevant files!

    2. Create a new method of organizing conversations:
        Properties of this organizing 