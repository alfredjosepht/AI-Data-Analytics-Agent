class Workflow:

    def __init__(self):
        self.steps = []

    def add_step(
        self,
        step_name
    ):
        self.steps.append(
            step_name
        )

    def get_workflow(self):

        return self.steps


workflow = Workflow()

workflow.add_step(
    "file_upload"
)

workflow.add_step(
    "data_cleaning"
)

workflow.add_step(
    "schema_detection"
)

workflow.add_step(
    "query_processing"
)

workflow.add_step(
    "visualization"
)