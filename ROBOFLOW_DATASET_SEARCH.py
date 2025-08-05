# === Find Available Roboflow Datasets ===
import roboflow

# Initialize Roboflow
rf = roboflow.Roboflow(api_key="gcscP35McEJicDDGOe5p")

# Check your available workspaces
print("=== Your Available Workspaces ===")
try:
    workspaces = rf.list_workspaces()
    for workspace in workspaces:
        print(f"Workspace: {workspace}")
except Exception as e:
    print(f"Error listing workspaces: {e}")

# Search for public datasets related to interior/walls/floors
print("\n=== Searching Public Datasets ===")

# Known public datasets to try
public_datasets = [
    # Architecture/Interior datasets
    ("roboflow-100", "wall-detection"),
    ("roboflow-100", "floor-detection"), 
    ("roboflow-100", "interior-design"),
    ("roboflow-100", "room-detection"),
    ("roboflow-100", "architectural-elements"),
    
    # University/Research datasets
    ("university-datasets", "interior-segmentation"),
    ("research-projects", "wall-floor-ceiling"),
    ("public-datasets", "interior-design"),
    
    # Specific interior datasets
    ("interior-ai", "wall-floor-detection"),
    ("architecture-ai", "room-segmentation"),
    ("home-design", "interior-elements"),
    
    # Try some common public workspace names
    ("public", "walls-floors"),
    ("demo", "interior-detection"),
    ("sample", "room-analysis"),
]

available_datasets = []

for workspace_name, project_name in public_datasets:
    try:
        workspace = rf.workspace(workspace_name)
        project = workspace.project(project_name)
        
        # Try to get project info
        project_info = project.list_versions()
        if project_info:
            available_datasets.append((workspace_name, project_name, project_info))
            print(f"✅ Found: {workspace_name}/{project_name}")
            print(f"   Versions: {len(project_info)}")
            
    except Exception as e:
        print(f"❌ {workspace_name}/{project_name}: {str(e)[:50]}...")
        continue

print(f"\n=== Summary ===")
print(f"Found {len(available_datasets)} accessible datasets")

if available_datasets:
    print("\nAvailable datasets:")
    for workspace, project, versions in available_datasets:
        print(f"- {workspace}/{project} ({len(versions)} versions)")
else:
    print("No public datasets found with these names")

# Alternative: Search Roboflow Universe directly
print("\n=== Alternative: Manual Universe Search ===")
print("Visit https://universe.roboflow.com and search for:")
print("- 'wall detection'")
print("- 'floor segmentation'") 
print("- 'interior design'")
print("- 'room analysis'")
print("- 'architectural elements'")
print("\nLook for datasets with 'Public Domain' or 'CC BY' licenses")