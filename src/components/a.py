score=[('小明',87),('小红',90),('小刚',85),('小绿',92),('小蓝',88)]
result=list(filter(lambda x: x[1]>=90, score))
print(result)
