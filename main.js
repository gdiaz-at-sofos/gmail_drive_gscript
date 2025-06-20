const GMAIL_FILTERS = "in:inbox has:attachment";
const DRIVE_FOLDER = "Files";

function main() {
  // Get keywords from Script Properties
  const keywords = PropertiesService.getScriptProperties().getProperty('SEARCH_KEYWORDS');

  if (!keywords || keywords.trim() === "") {
    Logger.log("Error: 'SEARCH_KEYWORDS' property is not set or is empty. Please configure it in Project Settings > Script properties");
    return;
  }

  // Expand the keywords to include accents (TODO) and plural forms
  const expandedKeywords = expandQueryKeywords(keywords);

  // Add API filters for the search query
  const query = expandedKeywords.join(" OR ") + " " + GMAIL_FILTERS;

  Logger.log(`Searching Gmail with query: '${query}'`);

  try {
    // GmailApp.search returns GmailThread objects.
    const threads = GmailApp.search(query);

    if (!threads.length) {
      Logger.log("No threads found with matching emails and attachments");
      return;
    }

    Logger.log(`Found ${threads.length} threads matching the query`);

    // Iterate through each thread and then each message within the thread
    for (const thread of threads) {
      const messages = thread.getMessages();

      for (const message of messages) {
        const attachments = message.getAttachments();

        if (!attachments.length) continue;

        const { senderName, senderEmail } = getSenderDetails(message);
        const subject = message.getSubject();
        const { timestamp, month, year } = getTimeDetails(message);

        const driveFolderPath = `${DRIVE_FOLDER}/${year}/${month}`;

        let parentFolderId = null
        for (const folderName of driveFolderPath.split("/")) {
          parentFolderId = findOrCreateFolder(folderName, parentFolderId);
        }

        for (const attachment of attachments) {
          const attachmentName = `(${senderName}) (${timestamp}) (${attachment.getName()})`
          const attachmentDescription = `Email from ${senderName}_${senderEmail} with subject '${subject}'`

          const attachmentDetails = {
            name: attachmentName,
            description: attachmentDescription,
            data: attachment.getBytes(),
            mimeType: attachment.getContentType()
          }

          saveToDrive(attachmentDetails, parentFolderId);
        }
      }
    }
  } catch (err) {
    Logger.log(`Error occurred during Gmail search: ${err.message}`);
  }
}

// Helper function to get time details from date field in a Gmail's message
function getTimeDetails(message) {
  const dateObject = message.getDate();

  if (!dateObject || !(dateObject instanceof Date)) {
    return { month: null, year: null, timestamp: null };
  }

  const year = dateObject.getFullYear().toString();
  const month = dateObject.toLocaleDateString('en-US', { month: 'long' });
  const timestamp = dateObject.toLocaleTimeString('es-VE', { hour12: false });

  return { month, year, timestamp };
}

// Helper function to get name and email from the sender field in a Gmail's message
function getSenderDetails(message) {
  const sender = message.getFrom();
  let senderName = '';
  let senderEmail = '';

  const match = sender.match(/^"?(.*?)"?\s*<(.*)>$/);

  if (match) {
    // Handles "Name <email@example.com>" or "<email@example.com>"
    senderName = match[1].trim();
    senderEmail = match[2].trim();
  } else {
    // Handles "email@example.com" (no angle brackets to separate the name part)
    senderEmail = sender.trim();
  }

  // Derive name from email if no found name
  if (senderName === '' || senderName === senderEmail) {
    senderName = senderEmail.split('@')[0];
  }

  return { senderName, senderEmail };
}

// Find a folder by name in a specific parent folder. If it doesn't exist, create it
function findOrCreateFolder(folderName, parentFolderId = null) {
  try {
    const parentFolder = parentFolderId
      ? DriveApp.getFolderById(parentFolderId)
      : DriveApp.getRootFolder();

    const folders = parentFolder.getFoldersByName(folderName);

    if (folders.hasNext()) {
      return folders.next().getId()
    } else {
      Logger.log(`Folder '${folderName}' not found in '${parentFolder.getName()}', creating...`);

      const folder = parentFolder.createFolder(folderName);

      Logger.log(`Folder '${folderName}' created with ID: ${folder.getId()}`);

      return folder.getId();
    }
  } catch (err) {
    Logger.log(`Error occurred: ${e.message}`);
    return null;
  }
}

// Save the file to Google Drive
function saveToDrive(attachmentDetails, parentFolderId) {
  try {
    // Check if attachment already exists in Drive folder
    const fileId = checkFileExistenceInFolder(attachmentDetails.name, parentFolderId);
    if (fileId) {
      Logger.log(`Skipping upload for '${attachmentDetails.name}' as it already exists`);
      return;
    }

    // Get Drive folder
    const driveFolder = DriveApp.getFolderById(parentFolderId);

    // Save file to Drive folder
    const driveFile = driveFolder.createFile(attachmentDetails.name, attachmentDetails.data, attachmentDetails.mimeType);

    // Add description to created file
    driveFile.setDescription(attachmentDetails.description)

    Logger.log(`File '${attachmentDetails.name}' saved to Drive with ID: ${driveFile.getId()}`);
  } catch (err) {
    Logger.log(`Error saving file '${attachmentDetails.name}' to Drive: ${err.message}`);
  }
}

// Checks if a file with the given name exists in the specified folder. Returns the file ID if it exists
function checkFileExistenceInFolder(filename, folderId) {
  try {
    const folder = DriveApp.getFolderById(folderId);

    const files = folder.getFilesByName(filename);

    const fileId = files.hasNext() ? files.next().getId() : null;

    return fileId;
  } catch (err) {
    Logger.log(`Error checking file existence in folder '${folderId}': ${err.message}`);
    return null;
  }
}

// Function to expand query keywords by adding plural forms and spell-checked candidates (TODO)
function expandQueryKeywords(keywords) {
  const expandedKeywords = new Set();

  if (!keywords) {
    return [];
  }

  for (const keyword of keywords.split(" ")) {
    // Skip empty strings from multiple spaces
    if (!keyword.trim()) continue;

    // Transform to lower case
    lowerCaseKeyword = keyword.toLowerCase()

    // Add the original keyword
    expandedKeywords.add(lowerCaseKeyword);

    // Add plural form if it exists and is different from the original
    const pluralFormOriginal = pluralize(lowerCaseKeyword);
    if (pluralFormOriginal && pluralFormOriginal !== lowerCaseKeyword) {
      expandedKeywords.add(pluralFormOriginal);
    }

    // Add naive accented versions of the keyword
    const correctedCandidates = getAccentCandidates(lowerCaseKeyword);

    if (correctedCandidates.length) {
      for (const correctedWord of correctedCandidates) {
        // Add spell-checked candidate
        expandedKeywords.add(correctedWord);

        // Add plural form
        const plural_form_corrected = pluralize(correctedWord);
        if (plural_form_corrected && plural_form_corrected != correctedWord) {
          expandedKeywords.add(plural_form_corrected);
        }
      }
    }
  }

  // Convert Set back to an array
  return Array.from(expandedKeywords);
}