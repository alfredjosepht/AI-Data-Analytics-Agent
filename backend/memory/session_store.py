active_workspace = {
    "workspace_id": None,
    "table_name": None,
    "schema": None
}


def set_active_workspace(
    workspace_id,
    table_name,
    schema
):

    active_workspace["workspace_id"] = workspace_id
    active_workspace["table_name"] = table_name
    active_workspace["schema"] = schema


def get_active_workspace():

    return active_workspace