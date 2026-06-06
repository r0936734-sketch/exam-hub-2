# Computer Science Syllabus Integration - Implementation Guide

## Overview

This document describes the implementation of categorized syllabus management and integrated question generation with automatic answer evaluation in the ExamHub AI Hub system.

## Architecture Changes

### 1. MongoDB Schema Updates

#### New Interfaces (in `src/server/aihub.ts`)

```typescript
export interface TopicCategory {
  name: string;                      // Main category (e.g., "DBMS", "Data Structures")
  subtopics: string[];               // List of specific topics
  description?: string;              // Optional category description
}

export interface GlobalSyllabus {
  _id?: ObjectId;
  subject: string;
  categorizedTopics: TopicCategory[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadedSyllabus {
  _id?: ObjectId;
  userId: string;
  subject: string;
  fileUrl: string;
  topics: string[];                  // Flat array for backward compatibility
  categorizedTopics: TopicCategory[]; // New categorized structure
  uploadedAt: Date;
}
```

### 2. Database Functions

**New functions in `src/server/aihub.ts`:**

- `storeCategorizedSyllabus()` - Store user's syllabus with categorized topics
- `getCategorizedTopics()` - Retrieve categories for a user
- `getSubtopicsFromCategory()` - Get subtopics from a specific category
- `storeGlobalSyllabus()` - Store global reference syllabus
- `getGlobalSyllabus()` - Retrieve global syllabus

### 3. AI Processing

**New function in `src/server/gemini.server.ts`:**

```typescript
export async function extractCategorizedTopicsFromSyllabus(
  syllabusText: string
): Promise<Array<{ name: string; subtopics: string[] }>>
```

This function uses Gemini AI to automatically parse a syllabus text and organize topics into categories.

### 4. Server Functions (Client-Server Communication)

**New functions in `src/services/aihub.server.ts`:**

- `getCategorizedTopicsFn` - Fetch categorized topics for a subject
- `getSubtopicsFromCategoryFn` - Fetch subtopics from a category
- `uploadSyllabusFn` - Updated to process and store categorized topics

## UI Component Changes

### Question Generator Component (`src/components/AIHub/question-generator.tsx`)

**Major Changes:**

1. **Category Selection Dropdown**
   - Displays all categories from the uploaded syllabus
   - Fetched on component mount

2. **Topic/Subtopic Selection Dropdown**
   - Populated based on selected category
   - Shows all subtopics in the selected category

3. **Integrated Answer Evaluator**
   - Moved from separate component into question generator
   - Appears after question generation
   - Allows uploading answer image for automatic evaluation
   - Shows evaluation results with feedback

**Component States:**

- `selectedCategory` - Currently selected category
- `selectedTopic` - Currently selected topic/subtopic
- `evaluationMode` - Shows/hides evaluation UI
- `evaluation` - Stores evaluation results

## Workflow

### Question Generation Workflow

1. User uploads syllabus in Syllabus Manager
2. System extracts and organizes topics into categories
3. Categories are stored in MongoDB (both user and global)
4. In Question Generator:
   - User selects category → Subtopics list updates
   - User selects topic → Can generate question
   - Generated question appears with evaluation section
   - User uploads answer image
   - System automatically evaluates and provides feedback

### Data Flow

```
Upload Syllabus Text
    ↓
Gemini AI (extractCategorizedTopicsFromSyllabus)
    ↓
Store in MongoDB (uploaded_syllabus collection)
    ↓
Question Generator loads categories
    ↓
User selects Category → Topic
    ↓
Generate Question
    ↓
Upload Answer Image
    ↓
Gemini AI (evaluateAnswer + extractTextFromImage)
    ↓
Display Evaluation Results
```

## Computer Science Syllabus

The system includes a pre-initialized syllabus with 13 main categories:

1. **Digital Logic and Circuits** - 7 topics
2. **Discrete Mathematical Structures** - 7 topics
3. **Computer Organization and Architecture** - 22 topics
4. **Data Structures and Algorithm** - 46 topics
5. **Problem Solving through C Programming** - 10 topics
6. **Object Oriented Techniques** - 23 topics
7. **Operating System** - 11 topics
8. **Database Management Systems** - 18 topics
9. **Computer Networks** - 19 topics
10. **Software Engineering** - 13 topics
11. **Internet Technology and Web Design** - 18 topics
12. **System Analysis and Design** - 8 topics
13. **Information Security and Cyber Laws** - 32 topics
14. **Computer Graphics** - 15 topics

**Total: 250+ topics across all categories**

## Initialization

To seed the database with the computer science syllabus:

1. Import `initializeSyllabus()` from `src/server/seed-computer-syllabus.ts`
2. Call during application startup or via admin endpoint
3. Creates `global_syllabus` collection entry

### Example Usage

```typescript
import { initializeSyllabus } from "@/server/seed-computer-syllabus";

// On app startup
try {
  await initializeSyllabus();
  console.log("Syllabus initialized");
} catch (error) {
  console.error("Failed to initialize:", error);
}
```

## Collections Used

### `uploaded_syllabus`
```
{
  _id: ObjectId,
  userId: string,
  subject: string,
  fileUrl: string,
  topics: [string],           // Flat array
  categorizedTopics: [{        // New structure
    name: string,
    subtopics: [string],
    description?: string
  }],
  uploadedAt: Date
}
```

### `global_syllabus`
```
{
  _id: ObjectId,
  subject: string,
  categorizedTopics: [{
    name: string,
    subtopics: [string],
    description?: string
  }],
  createdAt: Date,
  updatedAt: Date
}
```

## Backward Compatibility

- Old `topics: string[]` field is retained in `uploaded_syllabus`
- Existing queries continue to work with `getSyllabus()`
- New categorical features use new `categorizedTopics` field
- Migration path: Existing syllabi can be re-processed to extract categories

## Error Handling

All new functions include proper error handling:
- Network errors during AI processing
- Database connection failures
- Invalid input validation
- User authentication checks

## Performance Considerations

1. **Category Loading**: Cached in component state
2. **Lazy Loading**: Categories loaded only when subject is available
3. **Database Indexing**: Recommended indexes on `uploaded_syllabus`:
   - `{ userId, subject }`
   - `{ subject }`

## Future Enhancements

1. Search across categories and topics
2. Category-wise performance analytics
3. Difficulty level filtering
4. Category-wise question statistics
5. Custom category creation for users
6. Bulk category import/export

## Testing Checklist

- [ ] Upload syllabus and verify categorization
- [ ] Confirm categories appear in dropdown
- [ ] Select category and verify subtopics load
- [ ] Generate question from selected topic
- [ ] Upload answer image for evaluation
- [ ] Verify evaluation feedback displays correctly
- [ ] Test with different question types and marks
- [ ] Verify error messages display properly
- [ ] Check database for correct data structure
