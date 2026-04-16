def calculate_average(numbers):
    total = 0
    for num in numbers:
        total += num
    return total / len(numbers)


def format_percentage(value):
    return str(round(value * 100, 2)) + "%"
